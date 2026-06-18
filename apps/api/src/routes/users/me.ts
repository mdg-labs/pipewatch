import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import { resolveAuthIdentity } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  ProfileError,
  deleteUserAccount,
  getUserProfile,
  updateUserProfile,
} from "../../services/users/profile.js";
import type { ApiEnv } from "../../types.js";
import { clearAuthCookies, requireJwtSecret, resolveSecureCookies } from "../auth/shared.js";

const UserProfileSchema = z
  .object({
    name: z.string().nullable().openapi({ example: "Jane Doe" }),
    email: z.string().email().nullable().openapi({ example: "jane@example.com" }),
    avatar_url: z.string().url().nullable().openapi({
      example: "https://avatars.githubusercontent.com/u/1?v=4",
    }),
    github_login: z.string().openapi({ example: "janedoe" }),
  })
  .openapi("UserProfile");

const UpdateUserProfileBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(256)
      .nullable()
      .openapi({ example: "Jane Doe" }),
  })
  .openapi("UpdateUserProfileBody");

const getMeRoute = createRoute({
  method: "get",
  path: "/api/v1/users/me",
  tags: [OpenApiTags.USERS],
  summary: "Get current user profile",
  description:
    "Returns the authenticated user's profile. Email, avatar, and GitHub login are read-only GitHub fields.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Current user profile",
      content: {
        "application/json": {
          schema: UserProfileSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const patchMeRoute = createRoute({
  method: "patch",
  path: "/api/v1/users/me",
  tags: [OpenApiTags.USERS],
  summary: "Update current user profile",
  description: "Updates the authenticated user's display name only.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateUserProfileBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated user profile",
      content: {
        "application/json": {
          schema: UserProfileSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    422: {
      description: "Request validation failed",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const deleteMeRoute = createRoute({
  method: "delete",
  path: "/api/v1/users/me",
  tags: [OpenApiTags.USERS],
  summary: "Delete current user account",
  description:
    "Revokes all refresh tokens and deletes the user. Blocked with 409 when the user is the sole owner of a workspace that has other members.",
  security: [{ bearerAuth: [] }],
  responses: {
    204: {
      description: "Account deleted",
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Account delete blocked — sole owner of a shared workspace",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type UserMeDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

function resolveDatabase(deps?: Partial<UserMeDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

async function requireJwtUserId(c: Context<ApiEnv>, deps: UserMeDependencies): Promise<string> {
  const jwtSecret = requireJwtSecret(deps.env);
  const identity = await resolveAuthIdentity(
    deps.db,
    c.req.header("Authorization"),
    jwtSecret,
  );

  if (!identity || identity.authMode !== "jwt") {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  return identity.userId;
}

function handleProfileError(error: unknown): never {
  if (error instanceof ProfileError) {
    throw new HTTPException(error.status as 409, {
      message: error.message,
    });
  }

  throw error;
}

/** Register user profile routes (PRD §6, pages B13). */
export function registerUserMeRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<UserMeDependencies>,
): void {
  const resolveDeps = (): UserMeDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
  });

  app.openapi(getMeRoute, async (c) => {
    const resolved = resolveDeps();
    const userId = await requireJwtUserId(c, resolved);
    const profile = await getUserProfile(resolved.db, userId);

    if (!profile) {
      return c.json(apiError("NOT_FOUND", "User not found"), 404);
    }

    return c.json(profile, 200);
  });

  app.openapi(patchMeRoute, async (c) => {
    const resolved = resolveDeps();
    const userId = await requireJwtUserId(c, resolved);

    try {
      const profile = await updateUserProfile(resolved.db, userId, c.req.valid("json"));

      if (!profile) {
        return c.json(apiError("NOT_FOUND", "User not found"), 404);
      }

      return c.json(profile, 200);
    } catch (error) {
      handleProfileError(error);
    }
  });

  app.openapi(deleteMeRoute, async (c) => {
    const resolved = resolveDeps();
    const userId = await requireJwtUserId(c, resolved);
    const secure = resolveSecureCookies(resolved.env);

    try {
      await deleteUserAccount(resolved.db, userId);
      clearAuthCookies(c, secure);
      return c.body(null, 204);
    } catch (error) {
      handleProfileError(error);
    }
  });
}

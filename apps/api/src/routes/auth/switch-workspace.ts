import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";
import { workspaceMembers } from "@pipewatch/db/schema";
import type { WorkspaceRole } from "@pipewatch/types";
import { and, eq, isNotNull } from "drizzle-orm";

import { ApiErrorEnvelopeSchema } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  AuthError,
  REFRESH_COOKIE_NAME,
  requireActiveRefreshToken,
} from "../../services/auth/refresh-token.js";
import type { ApiEnv } from "../../types.js";
import {
  ACCESS_COOKIE_NAME,
  issueAccessTokenForUser,
  requireJwtSecret,
  resolveAuthCookieDomain,
  resolveSecureCookies,
  setAccessTokenCookie,
} from "./shared.js";

const SwitchWorkspaceBodySchema = z
  .object({
    workspaceId: z.string().uuid().openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
  })
  .openapi("SwitchWorkspaceBody");

const switchWorkspaceRoute = createRoute({
  method: "post",
  path: "/auth/switch-workspace",
  tags: [OpenApiTags.AUTH],
  summary: "Switch active workspace",
  description:
    "Issues a new access JWT scoped to the requested workspace. Requires a valid refresh cookie and workspace membership.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: SwitchWorkspaceBodySchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: "Workspace switched; new access cookie issued",
    },
    401: {
      description: "Missing or invalid refresh token",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Not a member of the requested workspace",
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

export type SwitchWorkspaceAuthDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

function resolveDatabase(deps?: Partial<SwitchWorkspaceAuthDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

function parseMembershipRole(role: string): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }

  return "member";
}

/** Register POST /auth/switch-workspace — issue JWT for a different workspace (PRD §20). */
export function registerSwitchWorkspaceRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<SwitchWorkspaceAuthDependencies>,
): void {
  const resolveDeps = (): SwitchWorkspaceAuthDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
  });

  app.openapi(switchWorkspaceRoute, async (c) => {
    const { env, db } = resolveDeps();
    const secure = resolveSecureCookies(env);

    try {
      const jwtSecret = requireJwtSecret(env);
      const refreshCookie = getCookie(c, REFRESH_COOKIE_NAME);
      const tokenRow = await requireActiveRefreshToken(db, refreshCookie);
      const body = c.req.valid("json");

      const [membership] = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.userId, tokenRow.userId),
            eq(workspaceMembers.workspaceId, body.workspaceId),
            isNotNull(workspaceMembers.acceptedAt),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new HTTPException(403, { message: "Not a member of this workspace" });
      }

      const role = parseMembershipRole(membership.role);
      const accessToken = await issueAccessTokenForUser(
        db,
        tokenRow.userId,
        jwtSecret,
        getCookie(c, ACCESS_COOKIE_NAME),
        { workspaceId: body.workspaceId, role },
      );

      setAccessTokenCookie(c, accessToken, secure, resolveAuthCookieDomain(env));

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new HTTPException(error.status as 401, {
          message: error.message,
        });
      }

      throw error;
    }
  });
}

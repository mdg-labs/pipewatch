import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import { resolveAuthIdentity } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema } from "../../middleware/error-handler.js";
import type { RateLimitDependencies } from "../../middleware/rate-limit.js";
import { createRateLimitMiddleware } from "../../middleware/rate-limit.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  acceptWorkspaceInvite,
  getInvitePreview,
  InviteError,
} from "../../services/workspaces/invite.service.js";
import type { ApiEnv } from "../../types.js";
import { requireJwtSecret } from "../auth/shared.js";

const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);

const InvitePreviewSchema = z
  .object({
    workspace_id: z.string().uuid(),
    workspace_name: z.string(),
    email: z.string().email(),
    role: WorkspaceRoleSchema,
    expires_at: z.string().datetime(),
  })
  .openapi("InvitePreview");

const AcceptInviteResultSchema = z
  .object({
    workspace_id: z.string().uuid(),
    workspace_name: z.string(),
    role: WorkspaceRoleSchema,
  })
  .openapi("AcceptInviteResult");

const getInviteRoute = createRoute({
  method: "get",
  path: "/invite/{token}",
  tags: [OpenApiTags.INVITES],
  summary: "Validate a workspace invite token",
  description: "Public endpoint to validate an invite before sign-in or acceptance (pages B18).",
  request: {
    params: z.object({
      token: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Valid invite",
      content: {
        "application/json": {
          schema: InvitePreviewSchema,
        },
      },
    },
    404: {
      description: "Invite not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Invite already accepted",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    410: {
      description: "Invite expired",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const acceptInviteRoute = createRoute({
  method: "post",
  path: "/invite/{token}/accept",
  tags: [OpenApiTags.INVITES],
  summary: "Accept a workspace invite",
  description:
    "Creates workspace membership for the authenticated user whose email matches the invite.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      token: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Invite accepted",
      content: {
        "application/json": {
          schema: AcceptInviteResultSchema,
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
    403: {
      description: "Invite email mismatch",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Invite not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Invite already accepted or user already a member",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    410: {
      description: "Invite expired",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type InviteAcceptDependencies = {
  env: ParsedApiEnv;
  db: Db;
  rateLimit?: Partial<RateLimitDependencies>;
};

function resolveDatabase(deps?: Partial<InviteAcceptDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

async function requireJwtUserId(c: Context<ApiEnv>, deps: InviteAcceptDependencies): Promise<string> {
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

function handleInviteServiceError(error: unknown): never {
  if (error instanceof InviteError) {
    throw new HTTPException(error.status as 403 | 404 | 409 | 410 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

/** Register public invite validation and accept routes (PRD §7, pages B18). */
export function registerInviteAcceptRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<InviteAcceptDependencies>,
): void {
  const rateLimitDeps = deps?.rateLimit ?? (deps?.env ? { env: deps.env } : undefined);
  app.use("/invite/*", createRateLimitMiddleware("invite", rateLimitDeps));

  const resolveDeps = (): InviteAcceptDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
  });

  app.openapi(getInviteRoute, async (c) => {
    const resolved = resolveDeps();
    const token = c.req.param("token");

    try {
      const preview = await getInvitePreview(resolved.db, token);
      return c.json(preview, 200);
    } catch (error) {
      handleInviteServiceError(error);
    }
  });

  app.openapi(acceptInviteRoute, async (c) => {
    const resolved = resolveDeps();
    const token = c.req.param("token");

    try {
      const userId = await requireJwtUserId(c, resolved);
      const result = await acceptWorkspaceInvite(resolved.db, token, userId);
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      handleInviteServiceError(error);
    }
  });
}

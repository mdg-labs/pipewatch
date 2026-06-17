import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { Db } from "@pipewatch/db";

import { getWorkspaceContext, roleMeetsMinimum } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import {
  ApiKeyError,
  createWorkspaceApiKey,
  listWorkspaceApiKeys,
  revokeWorkspaceApiKey,
} from "../../services/auth/api-key.js";
import type { ApiEnv } from "../../types.js";

const ApiKeySummarySchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    name: z.string(),
    key_prefix: z.string(),
    expires_at: z.string().datetime().nullable(),
    last_used_at: z.string().datetime().nullable(),
    revoked_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  })
  .openapi("ApiKeySummary");

const CreatedApiKeySchema = ApiKeySummarySchema.extend({
  key: z.string().openapi({
    description: "Full API key — shown once at creation; store securely.",
    example: "pw_live_x9k2m4n8p3q7r1s6",
  }),
}).openapi("CreatedApiKey");

const CreateApiKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(256).openapi({ example: "CI pipeline" }),
    expires_at: z.string().datetime().optional().openapi({
      example: "2027-01-01T00:00:00.000Z",
    }),
  })
  .openapi("CreateApiKeyBody");

const apiKeyParams = z.object({
  workspaceId: z.string().uuid(),
  keyId: z.string().uuid(),
});

const listApiKeysRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/api-keys",
  tags: ["Workspaces"],
  summary: "List workspace API keys",
  description:
    "Returns API key metadata (prefix only). Requires admin or owner. Full keys are never returned.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Workspace API keys",
      content: {
        "application/json": {
          schema: z.array(ApiKeySummarySchema),
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
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const createApiKeyRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/api-keys",
  tags: ["Workspaces"],
  summary: "Create a workspace API key",
  description:
    "Creates an API key and returns the full `pw_...` value once. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateApiKeyBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created API key",
      content: {
        "application/json": {
          schema: CreatedApiKeySchema,
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
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Workspace not found",
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

const deleteApiKeyRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/api-keys/{keyId}",
  tags: ["Workspaces"],
  summary: "Revoke a workspace API key",
  description: "Sets `revoked_at` on the key. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: apiKeyParams,
  },
  responses: {
    204: {
      description: "API key revoked",
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
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "API key not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type ApiKeyRoutesDependencies = {
  db: Db;
};

function handleApiKeyServiceError(error: unknown): never {
  if (error instanceof ApiKeyError) {
    throw new HTTPException(error.status as 403 | 404 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

function requireAdminContext(c: Parameters<typeof getWorkspaceContext>[0]) {
  const context = getWorkspaceContext(c);

  if (!context) {
    return { error: apiError("UNAUTHORIZED", "Authentication required"), status: 401 as const };
  }

  if (!roleMeetsMinimum(context.role, "admin")) {
    return {
      error: apiError("FORBIDDEN", "Insufficient workspace permissions"),
      status: 403 as const,
    };
  }

  return { context };
}

/** Register workspace API key routes (PRD §7, pages B11). */
export function registerApiKeyRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: ApiKeyRoutesDependencies,
): void {
  app.openapi(listApiKeysRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const keys = await listWorkspaceApiKeys(deps.db, workspaceId);
    return c.json(keys, 200);
  });

  app.openapi(createApiKeyRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");

    try {
      const created = await createWorkspaceApiKey(
        deps.db,
        workspaceId,
        auth.context.userId,
        c.req.valid("json"),
      );
      return c.json(created, 201);
    } catch (error) {
      handleApiKeyServiceError(error);
    }
  });

  app.openapi(deleteApiKeyRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const keyId = c.req.param("keyId");

    try {
      await revokeWorkspaceApiKey(deps.db, workspaceId, keyId);
      return c.body(null, 204);
    } catch (error) {
      handleApiKeyServiceError(error);
    }
  });
}

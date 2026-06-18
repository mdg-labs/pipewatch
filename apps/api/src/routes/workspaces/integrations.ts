import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import { getWorkspaceContext, roleMeetsMinimum } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  IntegrationError,
  createWorkspaceIntegration,
  deleteWorkspaceIntegration,
  getWorkspaceIntegration,
  listWorkspaceIntegrations,
} from "../../services/integrations/integration.service.js";
import type { ApiEnv } from "../../types.js";

const IntegrationAccountTypeSchema = z.enum(["Organization", "User"]);
const IntegrationTokenHealthSchema = z.enum(["healthy", "expiring", "expired"]);
const IntegrationProviderSchema = z.literal("github");

const IntegrationSummarySchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    provider: IntegrationProviderSchema,
    external_installation_id: z.string(),
    account_login: z.string(),
    account_type: IntegrationAccountTypeSchema,
    connected_repo_count: z.number().int().nonnegative(),
    token_health: IntegrationTokenHealthSchema,
    token_expires_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  })
  .openapi("IntegrationSummary");

const CreateIntegrationBodySchema = z
  .object({
    external_installation_id: z.string().trim().min(1).openapi({ example: "12345678" }),
    account_login: z.string().trim().min(1).openapi({ example: "mdg-labs" }),
    account_type: IntegrationAccountTypeSchema,
    access_token: z.string().trim().min(1).openapi({ example: "ghs_installation_token" }),
    token_expires_at: z.string().datetime().openapi({ example: "2026-06-17T12:00:00.000Z" }),
    provider: IntegrationProviderSchema.optional().openapi({ example: "github" }),
  })
  .openapi("CreateIntegrationBody");

const integrationParams = z.object({
  workspaceId: z.string().uuid(),
  integrationId: z.string().uuid(),
});

const listIntegrationsRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/integrations",
  tags: [OpenApiTags.INTEGRATIONS],
  summary: "List workspace integrations",
  description:
    "Returns GitHub integrations with account metadata, connected repo count, and token health. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Workspace integrations",
      content: {
        "application/json": {
          schema: z.array(IntegrationSummarySchema),
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

const getIntegrationRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/integrations/{integrationId}",
  tags: [OpenApiTags.INTEGRATIONS],
  summary: "Get integration details",
  description: "Returns a single integration. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: integrationParams,
  },
  responses: {
    200: {
      description: "Integration details",
      content: {
        "application/json": {
          schema: IntegrationSummarySchema,
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
      description: "Integration not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/integrations",
  tags: [OpenApiTags.INTEGRATIONS],
  summary: "Create a workspace integration",
  description:
    "Persists a GitHub App installation after callback processing (`provider=github`). Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateIntegrationBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created integration",
      content: {
        "application/json": {
          schema: IntegrationSummarySchema,
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
    409: {
      description: "Installation already connected",
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

const deleteIntegrationRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/integrations/{integrationId}",
  tags: [OpenApiTags.INTEGRATIONS],
  summary: "Disconnect a workspace integration",
  description:
    "Disables all repositories for the integration and removes the integration row. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: integrationParams,
  },
  responses: {
    204: {
      description: "Integration disconnected",
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
      description: "Integration not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type IntegrationRoutesDependencies = {
  db: Db;
  env: ParsedApiEnv;
};

function handleIntegrationServiceError(error: unknown): never {
  if (error instanceof IntegrationError) {
    throw new HTTPException(error.status as 403 | 404 | 409 | 422 | 500, {
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

/** Register workspace integration routes (PRD §7, pages B10). */
export function registerIntegrationRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: IntegrationRoutesDependencies,
): void {
  app.openapi(listIntegrationsRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const items = await listWorkspaceIntegrations(deps.db, workspaceId);
    return c.json(items, 200);
  });

  app.openapi(getIntegrationRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const integrationId = c.req.param("integrationId");
    const integration = await getWorkspaceIntegration(deps.db, workspaceId, integrationId);

    if (!integration) {
      return c.json(apiError("NOT_FOUND", "Integration not found"), 404);
    }

    return c.json(integration, 200);
  });

  app.openapi(createIntegrationRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");

    try {
      const created = await createWorkspaceIntegration(
        deps.db,
        deps.env,
        workspaceId,
        c.req.valid("json"),
      );
      return c.json(created, 201);
    } catch (error) {
      handleIntegrationServiceError(error);
    }
  });

  app.openapi(deleteIntegrationRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const integrationId = c.req.param("integrationId");

    try {
      await deleteWorkspaceIntegration(deps.db, workspaceId, integrationId);
      return c.body(null, 204);
    } catch (error) {
      handleIntegrationServiceError(error);
    }
  });
}

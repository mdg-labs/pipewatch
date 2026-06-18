import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import {
  enqueueBackfillRepo,
  type BackfillRepoJobPayload,
} from "@pipewatch/worker/queues/backfill.js";
import { syncPollingLifecycle } from "@pipewatch/worker/services/polling/lifecycle.js";

import { getWorkspaceContext, roleMeetsMinimum } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  deleteWorkspaceRepository,
  getWorkspaceRepository,
  listWorkspaceRepositories,
  RepositoryError,
  updateWorkspaceRepository,
} from "../../services/repositories/repository.service.js";
import type { ApiEnv } from "../../types.js";

const RepositorySummarySchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    integration_id: z.string().uuid(),
    external_repo_id: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    enabled: z.boolean(),
    polling_interval_seconds: z.number().int().nullable(),
    retention_days: z.number().int().nullable(),
    last_synced_at: z.string().datetime().nullable(),
  })
  .openapi("RepositorySummary");

const UpdateRepositoryBodySchema = z
  .object({
    enabled: z.boolean().optional().openapi({ example: true }),
    polling_interval_seconds: z
      .number()
      .int()
      .nullable()
      .optional()
      .openapi({ example: 60, description: "null switches to webhook mode; minimum 30 when set" }),
    retention_days: z
      .number()
      .int()
      .nullable()
      .optional()
      .openapi({ example: 90, description: "null uses workspace plan default" }),
  })
  .openapi("UpdateRepositoryBody");

const repositoryParams = z.object({
  workspaceId: z.string().uuid(),
  repoId: z.string().uuid(),
});

const listRepositoriesRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repositories",
  tags: [OpenApiTags.REPOSITORIES],
  summary: "List workspace repositories",
  description:
    "Returns tracked repositories with visibility and sync settings. Optional filters: enabled, integration_id.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    query: z.object({
      enabled: z
        .enum(["true", "false"])
        .optional()
        .openapi({ description: "Filter by enabled flag" }),
      integration_id: z.string().uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Workspace repositories",
      content: {
        "application/json": {
          schema: z.array(RepositorySummarySchema),
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
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const getRepositoryRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}",
  tags: [OpenApiTags.REPOSITORIES],
  summary: "Get repository details",
  security: [{ bearerAuth: [] }],
  request: {
    params: repositoryParams,
  },
  responses: {
    200: {
      description: "Repository details",
      content: {
        "application/json": {
          schema: RepositorySummarySchema,
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
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Repository not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const patchRepositoryRoute = createRoute({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}",
  tags: [OpenApiTags.REPOSITORIES],
  summary: "Update repository settings",
  description:
    "Updates enabled flag, polling interval (min 30s), and retention override (plan-clamped on cloud). Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: repositoryParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateRepositoryBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated repository",
      content: {
        "application/json": {
          schema: RepositorySummarySchema,
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
      description: "Insufficient permissions or repository limit reached",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Repository not found",
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

const deleteRepositoryRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}",
  tags: [OpenApiTags.REPOSITORIES],
  summary: "Delete repository data",
  description:
    "Removes the repository row and cascades pipeline runs. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: repositoryParams,
  },
  responses: {
    204: {
      description: "Repository deleted",
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
      description: "Repository not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const syncRepositoryRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/sync",
  tags: [OpenApiTags.REPOSITORIES],
  summary: "Trigger manual repository re-sync",
  description:
    "Enqueues a backfill-repo job to re-fetch run history from GitHub. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: repositoryParams,
  },
  responses: {
    202: {
      description: "Re-sync enqueued",
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
      description: "Repository not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    503: {
      description: "Queue unavailable",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type EnqueueBackfillRepo = (payload: BackfillRepoJobPayload) => Promise<void>;

export type SyncPollingLifecycle = (
  state: {
    repoId: string;
    workspaceId: string;
    integrationId: string;
    enabled: boolean;
    pollingIntervalSeconds: number | null;
  },
  previousState: {
    repoId: string;
    workspaceId: string;
    integrationId: string;
    enabled: boolean;
    pollingIntervalSeconds: number | null;
  },
) => Promise<void>;

export type RepositoryRoutesDependencies = {
  db: Db;
  env: ParsedApiEnv;
  enqueueBackfillRepo?: EnqueueBackfillRepo;
  syncPollingLifecycle?: SyncPollingLifecycle;
};

function handleRepositoryServiceError(error: unknown): never {
  if (error instanceof RepositoryError) {
    throw new HTTPException(error.status as 403 | 404 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

function requireMemberContext(c: Parameters<typeof getWorkspaceContext>[0]) {
  const context = getWorkspaceContext(c);

  if (!context) {
    return { error: apiError("UNAUTHORIZED", "Authentication required"), status: 401 as const };
  }

  return { context };
}

function requireAdminContext(c: Parameters<typeof getWorkspaceContext>[0]) {
  const auth = requireMemberContext(c);
  if ("error" in auth) {
    return auth;
  }

  if (!roleMeetsMinimum(auth.context.role, "admin")) {
    return {
      error: apiError("FORBIDDEN", "Insufficient workspace permissions"),
      status: 403 as const,
    };
  }

  return auth;
}

function parseEnabledQuery(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

/** Register workspace repository routes (PRD §7, pages B4/B5). */
export function registerRepositoryRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: RepositoryRoutesDependencies,
): void {
  app.openapi(listRepositoriesRoute, async (c) => {
    const auth = requireMemberContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const query = c.req.valid("query");

    const items = await listWorkspaceRepositories(deps.db, workspaceId, {
      enabled: parseEnabledQuery(query.enabled),
      integration_id: query.integration_id,
    });

    return c.json(items, 200);
  });

  app.openapi(getRepositoryRoute, async (c) => {
    const auth = requireMemberContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const repository = await getWorkspaceRepository(deps.db, workspaceId, repoId);

    if (!repository) {
      return c.json(apiError("NOT_FOUND", "Repository not found"), 404);
    }

    return c.json(repository, 200);
  });

  app.openapi(patchRepositoryRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");

    try {
      const updated = await updateWorkspaceRepository(
        deps.db,
        workspaceId,
        repoId,
        c.req.valid("json"),
        {
          syncPollingLifecycle:
            deps.syncPollingLifecycle ??
            (async (state, previousState) => {
              const redisUrl = deps.env.REDIS_URL;
              if (!redisUrl) {
                return;
              }

              await syncPollingLifecycle(redisUrl, deps.env.PIPEWATCH_MODE, {
                repoId: state.repoId,
                workspaceId: state.workspaceId,
                integrationId: state.integrationId,
                enabled: state.enabled,
                pollingIntervalSeconds: state.pollingIntervalSeconds,
              }, {
                repoId: previousState.repoId,
                workspaceId: previousState.workspaceId,
                integrationId: previousState.integrationId,
                enabled: previousState.enabled,
                pollingIntervalSeconds: previousState.pollingIntervalSeconds,
              });
            }),
        },
      );
      return c.json(updated, 200);
    } catch (error) {
      handleRepositoryServiceError(error);
    }
  });

  app.openapi(deleteRepositoryRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");

    try {
      await deleteWorkspaceRepository(deps.db, workspaceId, repoId);
      return c.body(null, 204);
    } catch (error) {
      handleRepositoryServiceError(error);
    }
  });

  app.openapi(syncRepositoryRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const repository = await getWorkspaceRepository(deps.db, workspaceId, repoId);

    if (!repository) {
      return c.json(apiError("NOT_FOUND", "Repository not found"), 404);
    }

    const enqueue = deps.enqueueBackfillRepo;
    if (enqueue) {
      await enqueue({
        repoId: repository.id,
        workspaceId,
        integrationId: repository.integration_id,
      });
      return c.body(null, 202);
    }

    const redisUrl = deps.env.REDIS_URL;
    if (!redisUrl) {
      return c.json(apiError("SERVICE_UNAVAILABLE", "Re-sync queue is unavailable"), 503);
    }

    await enqueueBackfillRepo(redisUrl, {
      repoId: repository.id,
      workspaceId,
      integrationId: repository.integration_id,
    });

    return c.body(null, 202);
  });
}

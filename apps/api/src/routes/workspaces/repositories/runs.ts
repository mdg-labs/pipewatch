import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { Db } from "@pipewatch/db";

import { getWorkspaceContext, roleMeetsMinimum } from "../../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../../middleware/error-handler.js";
import { OpenApiTags } from "../../../openapi-tags.js";
import {
  DEFAULT_PAGE_SIZE,
  deleteWorkspacePipelineRun,
  getWorkspacePipelineRun,
  listWorkspacePipelineRuns,
  MAX_PAGE_SIZE,
  PipelineRunError,
} from "../../../services/runs/pipeline-run.service.js";
import type { ApiEnv } from "../../../types.js";

const PipelineStatusSchema = z.enum(["queued", "in_progress", "completed"]);
const PipelineConclusionSchema = z
  .enum(["success", "failure", "cancelled", "skipped"])
  .nullable();

const PipelineRunSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    repo_id: z.string().uuid(),
    external_run_id: z.string(),
    pipeline_name: z.string(),
    pipeline_definition_ref: z.string(),
    status: PipelineStatusSchema,
    conclusion: PipelineConclusionSchema,
    branch: z.string(),
    commit_sha: z.string(),
    commit_message: z.string().nullable(),
    actor_login: z.string().nullable(),
    trigger_type: z.string(),
    source_url: z.string().url(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().nullable(),
    duration_ms: z.number().int().nullable(),
    created_at: z.string().datetime(),
  })
  .openapi("PipelineRun");

const PaginatedPipelineRunsSchema = z
  .object({
    data: z.array(PipelineRunSchema),
    cursor: z.string().nullable(),
    has_more: z.boolean(),
  })
  .openapi("PaginatedPipelineRuns");

const runParams = z.object({
  workspaceId: z.string().uuid(),
  repoId: z.string().uuid(),
});

const runDetailParams = runParams.extend({
  runId: z.string().uuid(),
});

const listRunsQuerySchema = z.object({
  branch: z.string().optional().openapi({ description: "Filter by branch name" }),
  workflow: z.string().optional().openapi({ description: "Filter by pipeline/workflow name" }),
  status: PipelineStatusSchema.optional().openapi({ description: "Filter by run status" }),
  trigger: z.string().optional().openapi({ description: "Filter by trigger type" }),
  started_from: z
    .string()
    .datetime()
    .optional()
    .openapi({ description: "Inclusive lower bound on started_at (ISO 8601)" }),
  started_to: z
    .string()
    .datetime()
    .optional()
    .openapi({ description: "Inclusive upper bound on started_at (ISO 8601)" }),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .openapi({ example: DEFAULT_PAGE_SIZE, description: "Page size (default 20, max 100)" }),
  cursor: z.string().optional().openapi({ description: "Opaque pagination cursor from prior page" }),
});

const listRunsRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs",
  tags: [OpenApiTags.PIPELINE_RUNS],
  summary: "List pipeline runs for a repository",
  description:
    "Returns paginated pipeline runs sorted by started_at desc. Filters: branch, workflow, status, trigger, date range.",
  security: [{ bearerAuth: [] }],
  request: {
    params: runParams,
    query: listRunsQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated pipeline runs",
      content: {
        "application/json": {
          schema: PaginatedPipelineRunsSchema,
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

const getRunRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}",
  tags: [OpenApiTags.PIPELINE_RUNS],
  summary: "Get pipeline run details",
  description: "Returns full B6 header fields for a single pipeline run.",
  security: [{ bearerAuth: [] }],
  request: {
    params: runDetailParams,
  },
  responses: {
    200: {
      description: "Pipeline run details",
      content: {
        "application/json": {
          schema: PipelineRunSchema,
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
      description: "Pipeline run not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const deleteRunRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}",
  tags: [OpenApiTags.PIPELINE_RUNS],
  summary: "Delete a pipeline run",
  description: "Manually purges a pipeline run and cascaded jobs/steps. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: runDetailParams,
  },
  responses: {
    204: {
      description: "Pipeline run deleted",
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
      description: "Pipeline run not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type RunRoutesDependencies = {
  db: Db;
};

function handlePipelineRunServiceError(error: unknown): never {
  if (error instanceof PipelineRunError) {
    throw new HTTPException(error.status as 404 | 422 | 500, {
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

/** Register workspace repository pipeline run routes (PRD §7, pages B4/B6). */
export function registerRunRoutes(app: OpenAPIHono<ApiEnv>, deps: RunRoutesDependencies): void {
  app.openapi(listRunsRoute, async (c) => {
    const auth = requireMemberContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const query = c.req.valid("query");

    try {
      const result = await listWorkspacePipelineRuns(deps.db, workspaceId, repoId, {
        branch: query.branch,
        workflow: query.workflow,
        status: query.status,
        trigger: query.trigger,
        started_from: query.started_from,
        started_to: query.started_to,
        page_size: query.page_size,
        cursor: query.cursor,
      });

      return c.json(
        {
          data: result.data,
          cursor: result.cursor,
          has_more: result.hasMore,
        },
        200,
      );
    } catch (error) {
      handlePipelineRunServiceError(error);
    }
  });

  app.openapi(getRunRoute, async (c) => {
    const auth = requireMemberContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const runId = c.req.param("runId");

    try {
      const run = await getWorkspacePipelineRun(deps.db, workspaceId, repoId, runId);

      if (!run) {
        return c.json(apiError("NOT_FOUND", "Pipeline run not found"), 404);
      }

      return c.json(run, 200);
    } catch (error) {
      handlePipelineRunServiceError(error);
    }
  });

  app.openapi(deleteRunRoute, async (c) => {
    const auth = requireAdminContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const runId = c.req.param("runId");

    try {
      await deleteWorkspacePipelineRun(deps.db, workspaceId, repoId, runId);
      return c.body(null, 204);
    } catch (error) {
      handlePipelineRunServiceError(error);
    }
  });
}

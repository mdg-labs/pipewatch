import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { Db } from "@pipewatch/db";

import { getWorkspaceContext } from "../../../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../../../middleware/error-handler.js";
import { OpenApiTags } from "../../../../openapi-tags.js";
import {
  listWorkspacePipelineJobSteps,
  listWorkspacePipelineJobs,
  PipelineJobError,
} from "../../../../services/runs/pipeline-job.service.js";
import type { ApiEnv } from "../../../../types.js";

const PipelineStatusSchema = z.enum(["queued", "in_progress", "completed"]);
const PipelineConclusionSchema = z
  .enum(["success", "failure", "cancelled", "skipped"])
  .nullable();

const PipelineJobSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    run_id: z.string().uuid(),
    external_job_id: z.string(),
    name: z.string(),
    status: PipelineStatusSchema,
    conclusion: PipelineConclusionSchema,
    runner_name: z.string().nullable(),
    source_url: z.string().url().nullable(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().nullable(),
    duration_ms: z.number().int().nullable(),
  })
  .openapi("PipelineJob");

const PipelineStepSchema = z
  .object({
    id: z.string().uuid(),
    job_id: z.string().uuid(),
    number: z.number().int(),
    name: z.string(),
    status: PipelineStatusSchema,
    conclusion: PipelineConclusionSchema,
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().nullable(),
    duration_ms: z.number().int().nullable(),
  })
  .openapi("PipelineStep");

const PipelineJobsListSchema = z
  .object({
    data: z.array(PipelineJobSchema),
  })
  .openapi("PipelineJobsList");

const PipelineStepsListSchema = z
  .object({
    data: z.array(PipelineStepSchema),
  })
  .openapi("PipelineStepsList");

const runParams = z.object({
  workspaceId: z.string().uuid(),
  repoId: z.string().uuid(),
  runId: z.string().uuid(),
});

const jobStepsParams = runParams.extend({
  jobId: z.string().uuid(),
});

const listJobsRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}/jobs",
  tags: [OpenApiTags.PIPELINE_JOBS],
  summary: "List pipeline jobs for a run",
  description:
    "Returns jobs ordered for DAG display (started_at asc). Includes runner_name, status, and durations.",
  security: [{ bearerAuth: [] }],
  request: {
    params: runParams,
  },
  responses: {
    200: {
      description: "Pipeline jobs for the run",
      content: {
        "application/json": {
          schema: PipelineJobsListSchema,
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
      description: "Repository, run, or jobs not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const listJobStepsRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}/jobs/{jobId}/steps",
  tags: [OpenApiTags.PIPELINE_STEPS],
  summary: "List steps for a pipeline job",
  description: "Returns steps ordered by step number within the job.",
  security: [{ bearerAuth: [] }],
  request: {
    params: jobStepsParams,
  },
  responses: {
    200: {
      description: "Pipeline steps for the job",
      content: {
        "application/json": {
          schema: PipelineStepsListSchema,
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
      description: "Repository, run, job, or steps not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type JobRoutesDependencies = {
  db: Db;
};

function handlePipelineJobServiceError(error: unknown): never {
  if (error instanceof PipelineJobError) {
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

/** Register workspace repository pipeline job and step routes (PRD §7, page B6). */
export function registerJobRoutes(app: OpenAPIHono<ApiEnv>, deps: JobRoutesDependencies): void {
  app.openapi(listJobsRoute, async (c) => {
    const auth = requireMemberContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const runId = c.req.param("runId");

    try {
      const jobs = await listWorkspacePipelineJobs(deps.db, workspaceId, repoId, runId);
      return c.json({ data: jobs }, 200);
    } catch (error) {
      handlePipelineJobServiceError(error);
    }
  });

  app.openapi(listJobStepsRoute, async (c) => {
    const auth = requireMemberContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const repoId = c.req.param("repoId");
    const runId = c.req.param("runId");
    const jobId = c.req.param("jobId");

    try {
      const steps = await listWorkspacePipelineJobSteps(
        deps.db,
        workspaceId,
        repoId,
        runId,
        jobId,
      );
      return c.json({ data: steps }, 200);
    } catch (error) {
      handlePipelineJobServiceError(error);
    }
  });
}

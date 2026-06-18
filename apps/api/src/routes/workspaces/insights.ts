import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { Db } from "@pipewatch/db";

import { getWorkspaceContext } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import { getWorkspaceInsights } from "../../services/insights-aggregates.js";
import type { ApiEnv } from "../../types.js";

const InsightsRangeSchema = z.enum(["7d", "30d"]);

const InsightsMostActiveRepoSchema = z
  .object({
    repo_id: z.string().uuid(),
    full_name: z.string(),
    run_count: z.number().int().min(0),
  })
  .openapi("InsightsMostActiveRepo");

const InsightsSummarySchema = z
  .object({
    total_runs: z.number().int().min(0),
    success_rate: z.number().min(0).max(100),
    avg_duration_ms: z.number().int().nullable(),
    most_active_repo: InsightsMostActiveRepoSchema.nullable(),
    trends: z.object({
      total_runs_percent: z.number().nullable(),
      success_rate_points: z.number().nullable(),
      avg_duration_percent: z.number().nullable(),
    }),
  })
  .openapi("InsightsSummary");

const InsightsTimeSeriesPointSchema = z
  .object({
    workflow: z.string(),
    repo_id: z.string().uuid(),
    repo_full_name: z.string(),
    value: z.number(),
  })
  .openapi("InsightsTimeSeriesPoint");

const InsightsTimeSeriesDaySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    points: z.array(InsightsTimeSeriesPointSchema),
  })
  .openapi("InsightsTimeSeriesDay");

const InsightsSlowestWorkflowSchema = z
  .object({
    workflow: z.string(),
    repo_id: z.string().uuid(),
    repo_full_name: z.string(),
    avg_duration_ms: z.number().int().nullable(),
    p50_duration_ms: z.number().int().nullable(),
    p95_duration_ms: z.number().int().nullable(),
    run_count: z.number().int().min(0),
    trend_percent: z.number().nullable(),
  })
  .openapi("InsightsSlowestWorkflow");

const InsightsMostFailingWorkflowSchema = z
  .object({
    workflow: z.string(),
    repo_id: z.string().uuid(),
    repo_full_name: z.string(),
    failure_rate: z.number().min(0).max(100),
    failure_count: z.number().int().min(0),
    run_count: z.number().int().min(0),
    trend_percent: z.number().nullable(),
  })
  .openapi("InsightsMostFailingWorkflow");

const WorkspaceInsightsSchema = z
  .object({
    range: InsightsRangeSchema,
    summary: InsightsSummarySchema,
    time_series: z.object({
      duration: z.array(InsightsTimeSeriesDaySchema),
      failure_rate: z.array(InsightsTimeSeriesDaySchema),
    }),
    slowest_workflows: z.array(InsightsSlowestWorkflowSchema),
    most_failing_workflows: z.array(InsightsMostFailingWorkflowSchema),
  })
  .openapi("WorkspaceInsights");

const insightsQuerySchema = z.object({
  range: InsightsRangeSchema.default("7d").openapi({
    description: "Time window for aggregates",
    example: "7d",
  }),
  repoId: z
    .string()
    .uuid()
    .optional()
    .openapi({ description: "Optional repository filter" }),
  workflow: z
    .string()
    .optional()
    .openapi({ description: "Optional pipeline/workflow name filter" }),
});

const insightsRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/insights",
  tags: [OpenApiTags.INSIGHTS],
  summary: "Get workspace insights aggregates",
  description:
    "Returns summary cards, per-workflow time series, and slowest/most-failing workflow tables for the selected range.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    query: insightsQuerySchema,
  },
  responses: {
    200: {
      description: "Workspace insights aggregates",
      content: {
        "application/json": {
          schema: WorkspaceInsightsSchema,
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

export type InsightsRoutesDependencies = {
  db: Db;
};

/** Register workspace insights route (PRD §12.5, pages B7). */
export function registerInsightsRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: InsightsRoutesDependencies,
): void {
  app.openapi(insightsRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const query = c.req.valid("query");

    const insights = await getWorkspaceInsights(deps.db, workspaceId, {
      range: query.range,
      ...(query.repoId ? { repoId: query.repoId } : {}),
      ...(query.workflow ? { workflow: query.workflow } : {}),
    });

    return c.json(insights, 200);
  });
}

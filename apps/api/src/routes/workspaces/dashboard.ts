import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { Db } from "@pipewatch/db";

import { getWorkspaceContext } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import { getWorkspaceDashboard } from "../../services/dashboard-aggregates.js";
import type { ApiEnv } from "../../types.js";

const PipelineStatusSchema = z.enum(["queued", "in_progress", "completed"]);
const PipelineConclusionSchema = z
  .enum(["success", "failure", "cancelled", "skipped"])
  .nullable();

const DashboardLastRunSchema = z
  .object({
    id: z.string().uuid(),
    external_run_id: z.string(),
    pipeline_name: z.string(),
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
  })
  .openapi("DashboardLastRun");

const DashboardRepoCardSchema = z
  .object({
    id: z.string().uuid(),
    full_name: z.string(),
    integration_id: z.string().uuid(),
    is_running: z.boolean(),
    health: z.enum(["healthy", "running", "failing"]),
    last_run: DashboardLastRunSchema.nullable(),
    sparkline: z
      .array(z.number().int().min(0).max(100))
      .length(7)
      .openapi({ description: "Daily failure rate (0–100) for the last 7 UTC days, oldest first" }),
  })
  .openapi("DashboardRepoCard");

const WorkspaceDashboardSchema = z
  .object({
    health: z
      .object({
        healthy: z.number().int().min(0),
        running: z.number().int().min(0),
        failing: z.number().int().min(0),
        total: z.number().int().min(0),
      })
      .openapi("DashboardHealthSummary"),
    repos: z.array(DashboardRepoCardSchema),
  })
  .openapi("WorkspaceDashboard");

const dashboardRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/dashboard",
  tags: [OpenApiTags.WORKSPACES],
  summary: "Get workspace dashboard aggregates",
  description:
    "Returns global health counts and per-repo card data: last run, 7-day failure-rate sparkline, and running pulse flag.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Workspace dashboard aggregates",
      content: {
        "application/json": {
          schema: WorkspaceDashboardSchema,
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

export type DashboardRoutesDependencies = {
  db: Db;
};

/** Register workspace dashboard route (PRD §12.2, pages B3). */
export function registerDashboardRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: DashboardRoutesDependencies,
): void {
  app.openapi(dashboardRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const dashboard = await getWorkspaceDashboard(deps.db, workspaceId);

    return c.json(dashboard, 200);
  });
}

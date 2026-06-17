import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import { getWorkspaceContext } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import {
  getWorkspaceSyncStatus,
  type ListBackfillJobs,
} from "../../services/sync-status.js";
import type { ApiEnv } from "../../types.js";

const SyncStatusRepoSchema = z
  .object({
    id: z.string().uuid(),
    enabled: z.boolean(),
    last_synced_at: z.string().datetime().nullable(),
    backfill_in_progress: z.boolean(),
  })
  .openapi("SyncStatusRepo");

const SyncStatusIntegrationSchema = z
  .object({
    id: z.string().uuid(),
    enabled: z.boolean(),
    last_synced_at: z.string().datetime().nullable(),
    backfill_in_progress: z.boolean(),
    repos: z.array(SyncStatusRepoSchema),
  })
  .openapi("SyncStatusIntegration");

const WorkspaceSyncStatusSchema = z
  .object({
    integrations: z.array(SyncStatusIntegrationSchema),
  })
  .openapi("WorkspaceSyncStatus");

const syncStatusRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/sync-status",
  tags: ["Workspaces"],
  summary: "Get workspace sync and backfill status",
  description:
    "Returns per-integration and per-repo sync state for onboarding progress and manual re-sync feedback. Optional integrationId filter.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    query: z.object({
      integrationId: z.string().uuid().optional().openapi({
        description: "Limit results to a single integration",
      }),
    }),
  },
  responses: {
    200: {
      description: "Workspace sync status",
      content: {
        "application/json": {
          schema: WorkspaceSyncStatusSchema,
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

export type SyncStatusRoutesDependencies = {
  db: Db;
  env: ParsedApiEnv;
  listBackfillJobs?: ListBackfillJobs;
};

/** Register workspace sync-status route (PRD §13 step 3, pages B2/B10). */
export function registerSyncStatusRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: SyncStatusRoutesDependencies,
): void {
  app.openapi(syncStatusRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const { integrationId } = c.req.valid("query");

    const status = await getWorkspaceSyncStatus(deps.db, workspaceId, {
      ...(integrationId ? { integrationId } : {}),
      ...(deps.env.REDIS_URL ? { redisUrl: deps.env.REDIS_URL } : {}),
      ...(deps.listBackfillJobs ? { listBackfillJobs: deps.listBackfillJobs } : {}),
    });

    return c.json(status, 200);
  });
}

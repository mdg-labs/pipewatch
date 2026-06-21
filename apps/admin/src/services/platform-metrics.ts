import type { WorkspacePlan } from "@pipewatch/config/plan-limits";
import type { Db } from "@pipewatch/db";
import { pipelineRuns, users, workspaceMembers } from "@pipewatch/db/schema";
import {
  publicIntegrations,
  publicWorkspaces,
} from "@pipewatch/db-admin/public-read";
import { count, desc, eq, gte } from "drizzle-orm";

import type { ListQuery, PaginatedResult } from "./overview.js";

const PIPELINE_RUN_WINDOW_DAYS = 30;

export type WorkspacesByPlan = Record<WorkspacePlan, number>;

export type PlatformMetricsSummary = {
  totalWorkspaces: number;
  totalIntegrations: number;
  totalProductUsers: number;
  totalPipelineRuns: number;
  pipelineRunsLast30Days: number;
  workspacesByPlan: WorkspacesByPlan;
};

export type PlatformMetricsWorkspace = {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  integrationCount: number;
  pipelineRunCount: number;
};

function emptyWorkspacesByPlan(): WorkspacesByPlan {
  return { free: 0, pro: 0, business: 0 };
}

function toWorkspacesByPlan(
  rows: Array<{ plan: string; count: number }>,
): WorkspacesByPlan {
  const result = emptyWorkspacesByPlan();

  for (const row of rows) {
    if (row.plan === "free" || row.plan === "pro" || row.plan === "business") {
      result[row.plan] = row.count;
    }
  }

  return result;
}

function workspaceMetricJoins(database: Db) {
  const integrationCounts = database
    .select({
      workspaceId: publicIntegrations.workspaceId,
      integrationCount: count().as("integration_count"),
    })
    .from(publicIntegrations)
    .groupBy(publicIntegrations.workspaceId)
    .as("integration_counts");

  const memberCounts = database
    .select({
      workspaceId: workspaceMembers.workspaceId,
      memberCount: count().as("member_count"),
    })
    .from(workspaceMembers)
    .groupBy(workspaceMembers.workspaceId)
    .as("member_counts");

  const pipelineRunCounts = database
    .select({
      workspaceId: pipelineRuns.workspaceId,
      pipelineRunCount: count().as("pipeline_run_count"),
    })
    .from(pipelineRuns)
    .groupBy(pipelineRuns.workspaceId)
    .as("pipeline_run_counts");

  return { integrationCounts, memberCounts, pipelineRunCounts };
}

/** Aggregate platform metrics from read-only `public.*` queries (Admin PRD §8.5). */
export async function getPlatformMetricsSummary(
  database: Db,
  options: { now?: Date } = {},
): Promise<PlatformMetricsSummary> {
  const now = options.now ?? new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - PIPELINE_RUN_WINDOW_DAYS);

  const [
    [workspaceCountRow],
    [integrationCountRow],
    [userCountRow],
    [pipelineRunCountRow],
    [pipelineRunsLast30DaysRow],
    planRows,
  ] = await Promise.all([
    database.select({ total: count() }).from(publicWorkspaces),
    database.select({ total: count() }).from(publicIntegrations),
    database.select({ total: count() }).from(users),
    database.select({ total: count() }).from(pipelineRuns),
    database
      .select({ total: count() })
      .from(pipelineRuns)
      .where(gte(pipelineRuns.createdAt, windowStart)),
    database
      .select({
        plan: publicWorkspaces.plan,
        count: count(),
      })
      .from(publicWorkspaces)
      .groupBy(publicWorkspaces.plan),
  ]);

  return {
    totalWorkspaces: workspaceCountRow?.total ?? 0,
    totalIntegrations: integrationCountRow?.total ?? 0,
    totalProductUsers: userCountRow?.total ?? 0,
    totalPipelineRuns: pipelineRunCountRow?.total ?? 0,
    pipelineRunsLast30Days: pipelineRunsLast30DaysRow?.total ?? 0,
    workspacesByPlan: toWorkspacesByPlan(
      planRows.map((row) => ({ plan: row.plan, count: row.count })),
    ),
  };
}

/** Paginated per-workspace rollup with denormalized pipeline run counts (Admin PRD §8.5). */
export async function listPlatformMetricsWorkspaces(
  database: Db,
  query: ListQuery,
): Promise<PaginatedResult<PlatformMetricsWorkspace>> {
  const offset = (query.page - 1) * query.pageSize;
  const { integrationCounts, memberCounts, pipelineRunCounts } =
    workspaceMetricJoins(database);

  const [totalRow] = await database
    .select({ total: count() })
    .from(publicWorkspaces);

  const rows = await database
    .select({
      id: publicWorkspaces.id,
      slug: publicWorkspaces.slug,
      name: publicWorkspaces.name,
      integrationCount: integrationCounts.integrationCount,
      memberCount: memberCounts.memberCount,
      pipelineRunCount: pipelineRunCounts.pipelineRunCount,
    })
    .from(publicWorkspaces)
    .leftJoin(integrationCounts, eq(publicWorkspaces.id, integrationCounts.workspaceId))
    .leftJoin(memberCounts, eq(publicWorkspaces.id, memberCounts.workspaceId))
    .leftJoin(pipelineRunCounts, eq(publicWorkspaces.id, pipelineRunCounts.workspaceId))
    .orderBy(desc(publicWorkspaces.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      memberCount: row.memberCount ?? 0,
      integrationCount: row.integrationCount ?? 0,
      pipelineRunCount: row.pipelineRunCount ?? 0,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.total ?? 0,
  };
}

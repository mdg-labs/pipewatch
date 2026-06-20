import { parseWorkspacePlan, type WorkspacePlan } from "@pipewatch/config/plan-limits";
import type { Db } from "@pipewatch/db";
import { workspaceMembers } from "@pipewatch/db/schema";
import {
  publicIntegrations,
  publicWorkspaces,
} from "@pipewatch/db-admin/public-read";
import { count, desc, eq } from "drizzle-orm";

export type WorkspaceOverview = {
  id: string;
  slug: string;
  name: string;
  plan: WorkspacePlan;
  createdAt: string;
  defaultRetentionDays: number;
  integrationCount: number;
  memberCount: number;
};

export type IntegrationOverview = {
  id: string;
  workspaceId: string;
  externalInstallationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ListQuery = {
  page: number;
  pageSize: number;
};

function workspaceCountJoins(database: Db) {
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

  return { integrationCounts, memberCounts };
}

function toWorkspaceOverview(row: {
  id: string;
  slug: string;
  name: string;
  plan: string;
  createdAt: Date;
  defaultRetentionDays: number;
  integrationCount: number | null;
  memberCount: number | null;
}): WorkspaceOverview {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    plan: parseWorkspacePlan(row.plan),
    createdAt: row.createdAt.toISOString(),
    defaultRetentionDays: row.defaultRetentionDays,
    integrationCount: row.integrationCount ?? 0,
    memberCount: row.memberCount ?? 0,
  };
}

/** Paginated workspace list with plan and aggregate counts (Admin PRD §8.5, §12.5). */
export async function listWorkspaces(
  database: Db,
  query: ListQuery,
): Promise<PaginatedResult<WorkspaceOverview>> {
  const offset = (query.page - 1) * query.pageSize;
  const { integrationCounts, memberCounts } = workspaceCountJoins(database);

  const [totalRow] = await database
    .select({ total: count() })
    .from(publicWorkspaces);

  const rows = await database
    .select({
      id: publicWorkspaces.id,
      slug: publicWorkspaces.slug,
      name: publicWorkspaces.name,
      plan: publicWorkspaces.plan,
      createdAt: publicWorkspaces.createdAt,
      defaultRetentionDays: publicWorkspaces.defaultRetentionDays,
      integrationCount: integrationCounts.integrationCount,
      memberCount: memberCounts.memberCount,
    })
    .from(publicWorkspaces)
    .leftJoin(integrationCounts, eq(publicWorkspaces.id, integrationCounts.workspaceId))
    .leftJoin(memberCounts, eq(publicWorkspaces.id, memberCounts.workspaceId))
    .orderBy(desc(publicWorkspaces.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  return {
    items: rows.map(toWorkspaceOverview),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.total ?? 0,
  };
}

/** Workspace detail by id — excludes Stripe and token fields (Admin PRD §8.5). */
export async function getWorkspaceById(
  database: Db,
  workspaceId: string,
): Promise<WorkspaceOverview | null> {
  const { integrationCounts, memberCounts } = workspaceCountJoins(database);

  const [row] = await database
    .select({
      id: publicWorkspaces.id,
      slug: publicWorkspaces.slug,
      name: publicWorkspaces.name,
      plan: publicWorkspaces.plan,
      createdAt: publicWorkspaces.createdAt,
      defaultRetentionDays: publicWorkspaces.defaultRetentionDays,
      integrationCount: integrationCounts.integrationCount,
      memberCount: memberCounts.memberCount,
    })
    .from(publicWorkspaces)
    .leftJoin(integrationCounts, eq(publicWorkspaces.id, integrationCounts.workspaceId))
    .leftJoin(memberCounts, eq(publicWorkspaces.id, memberCounts.workspaceId))
    .where(eq(publicWorkspaces.id, workspaceId))
    .limit(1);

  return row ? toWorkspaceOverview(row) : null;
}

/** Paginated integration list with linked workspace metadata (Admin PRD §8.5). */
export async function listIntegrations(
  database: Db,
  query: ListQuery,
): Promise<PaginatedResult<IntegrationOverview>> {
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await database
    .select({ total: count() })
    .from(publicIntegrations);

  const rows = await database
    .select({
      id: publicIntegrations.id,
      workspaceId: publicIntegrations.workspaceId,
      externalInstallationId: publicIntegrations.externalInstallationId,
      accountLogin: publicIntegrations.accountLogin,
      accountType: publicIntegrations.accountType,
      createdAt: publicIntegrations.createdAt,
      workspaceSlug: publicWorkspaces.slug,
      workspaceName: publicWorkspaces.name,
    })
    .from(publicIntegrations)
    .innerJoin(publicWorkspaces, eq(publicIntegrations.workspaceId, publicWorkspaces.id))
    .orderBy(desc(publicIntegrations.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      externalInstallationId: row.externalInstallationId,
      accountLogin: row.accountLogin,
      accountType: row.accountType,
      createdAt: row.createdAt.toISOString(),
      workspace: {
        id: row.workspaceId,
        slug: row.workspaceSlug,
        name: row.workspaceName,
      },
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.total ?? 0,
  };
}

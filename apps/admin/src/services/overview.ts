import { parseWorkspacePlan, type WorkspacePlan } from "@pipewatch/config/plan-limits";
import type { Db } from "@pipewatch/db";
import { users, workspaceMembers } from "@pipewatch/db/schema";
import {
  publicIntegrations,
  publicWorkspaces,
} from "@pipewatch/db-admin/public-read";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { and, count, desc, eq, gte } from "drizzle-orm";

import { isNonSuccessStatusCode } from "./alerts/webhook-health.js";

const NESTED_LIST_LIMIT = 100;

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

export type WorkspaceIntegrationSummary = {
  id: string;
  externalInstallationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: string;
};

export type WorkspaceMemberSummary = {
  userId: string;
  email: string | null;
  role: string;
};

export type RecentWebhookHealthSummary = {
  windowMinutes: number;
  total: number;
  successCount: number;
  failureCount: number;
  unreachableCount: number;
  failureRate: number;
};

export type WorkspaceDetail = WorkspaceOverview & {
  integrations: WorkspaceIntegrationSummary[];
  members: WorkspaceMemberSummary[];
  recentWebhookHealth: RecentWebhookHealthSummary;
};

export type IntegrationDetail = {
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
  recentWebhookHealth: RecentWebhookHealthSummary;
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

function toRecentWebhookHealthSummary(
  windowMinutes: number,
  statusCodes: number[],
): RecentWebhookHealthSummary {
  let failureCount = 0;
  let unreachableCount = 0;

  for (const statusCode of statusCodes) {
    if (isNonSuccessStatusCode(statusCode)) {
      failureCount += 1;
    }
    if (statusCode === 0) {
      unreachableCount += 1;
    }
  }

  const total = statusCodes.length;
  const successCount = total - failureCount;

  return {
    windowMinutes,
    total,
    successCount,
    failureCount,
    unreachableCount,
    failureRate: total === 0 ? 0 : failureCount / total,
  };
}

async function getRecentWebhookHealthForWorkspace(
  database: Db,
  workspaceId: string,
  windowMinutes: number,
  now = new Date(),
): Promise<RecentWebhookHealthSummary> {
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const rows = await database
    .select({ statusCode: webhookDeliveries.statusCode })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.workspaceId, workspaceId),
        gte(webhookDeliveries.deliveredAt, since),
      ),
    );

  return toRecentWebhookHealthSummary(
    windowMinutes,
    rows.map((row) => row.statusCode),
  );
}

async function getRecentWebhookHealthForInstallation(
  database: Db,
  externalInstallationId: string,
  windowMinutes: number,
  now = new Date(),
): Promise<RecentWebhookHealthSummary> {
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const rows = await database
    .select({ statusCode: webhookDeliveries.statusCode })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.externalInstallationId, externalInstallationId),
        gte(webhookDeliveries.deliveredAt, since),
      ),
    );

  return toRecentWebhookHealthSummary(
    windowMinutes,
    rows.map((row) => row.statusCode),
  );
}

/** Workspace detail by id — excludes Stripe and token fields (Admin PRD §8.5). */
export async function getWorkspaceById(
  database: Db,
  workspaceId: string,
  options: { windowMinutes: number },
): Promise<WorkspaceDetail | null> {
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

  if (!row) {
    return null;
  }

  const [integrationRows, memberRows, recentWebhookHealth] = await Promise.all([
    database
      .select({
        id: publicIntegrations.id,
        externalInstallationId: publicIntegrations.externalInstallationId,
        accountLogin: publicIntegrations.accountLogin,
        accountType: publicIntegrations.accountType,
        createdAt: publicIntegrations.createdAt,
      })
      .from(publicIntegrations)
      .where(eq(publicIntegrations.workspaceId, workspaceId))
      .orderBy(desc(publicIntegrations.createdAt))
      .limit(NESTED_LIST_LIMIT),
    database
      .select({
        userId: workspaceMembers.userId,
        email: users.email,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(desc(workspaceMembers.invitedAt))
      .limit(NESTED_LIST_LIMIT),
    getRecentWebhookHealthForWorkspace(database, workspaceId, options.windowMinutes),
  ]);

  return {
    ...toWorkspaceOverview(row),
    integrations: integrationRows.map((integration) => ({
      id: integration.id,
      externalInstallationId: integration.externalInstallationId,
      accountLogin: integration.accountLogin,
      accountType: integration.accountType,
      createdAt: integration.createdAt.toISOString(),
    })),
    members: memberRows.map((member) => ({
      userId: member.userId,
      email: member.email,
      role: member.role,
    })),
    recentWebhookHealth,
  };
}

/** Integration detail by id with workspace metadata (Admin PRD §8.5). */
export async function getIntegrationById(
  database: Db,
  integrationId: string,
  options: { windowMinutes: number },
): Promise<IntegrationDetail | null> {
  const [row] = await database
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
    .where(eq(publicIntegrations.id, integrationId))
    .limit(1);

  if (!row) {
    return null;
  }

  const recentWebhookHealth = await getRecentWebhookHealthForInstallation(
    database,
    row.externalInstallationId,
    options.windowMinutes,
  );

  return {
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
    recentWebhookHealth,
  };
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

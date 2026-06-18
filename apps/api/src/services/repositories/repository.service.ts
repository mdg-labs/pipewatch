import { getPlanLimits, parseWorkspacePlan } from "@pipewatch/config/plan-limits";
import { and, count, eq, type SQL } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { repositories, workspaces } from "@pipewatch/db/schema";
import type {
  ListRepositoriesQuery,
  RepositorySummary,
  UpdateRepositoryInput,
  WorkspacePlan,
} from "@pipewatch/types";

import {
  assertRepoEnableAllowed,
  PlanLimitError,
  resolveRetentionDaysForPatch,
} from "../../middleware/plan-limits.js";

const MIN_POLLING_INTERVAL_SECONDS = 30;

export type RepositoryPollingState = {
  repoId: string;
  workspaceId: string;
  integrationId: string;
  enabled: boolean;
  pollingIntervalSeconds: number | null;
};

export type SyncPollingLifecycle = (
  state: RepositoryPollingState,
  previousState: RepositoryPollingState,
) => Promise<void>;

export type UpdateRepositoryOptions = {
  syncPollingLifecycle?: SyncPollingLifecycle;
};

function toRepositoryPollingState(
  row: typeof repositories.$inferSelect,
): RepositoryPollingState {
  return {
    repoId: row.id,
    workspaceId: row.workspaceId,
    integrationId: row.integrationId,
    enabled: row.enabled,
    pollingIntervalSeconds: row.pollingIntervalSeconds,
  };
}

export class RepositoryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "RepositoryError";
    this.status = status;
    this.code = code;
  }
}

function toRepositorySummary(row: typeof repositories.$inferSelect): RepositorySummary {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    integration_id: row.integrationId,
    external_repo_id: row.externalRepoId,
    full_name: row.fullName,
    private: row.private,
    enabled: row.enabled,
    polling_interval_seconds: row.pollingIntervalSeconds,
    retention_days: row.retentionDays,
    last_synced_at: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  };
}

function validateRetentionDays(
  plan: WorkspacePlan,
  days: number | null | undefined,
): number | null | undefined {
  try {
    return resolveRetentionDaysForPatch(plan, days);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new RepositoryError(error.message, error.status, error.code);
    }

    throw error;
  }
}

function validatePollingIntervalSeconds(
  value: number | null | undefined,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < MIN_POLLING_INTERVAL_SECONDS) {
    throw new RepositoryError(
      `polling_interval_seconds must be at least ${String(MIN_POLLING_INTERVAL_SECONDS)}`,
      422,
      "VALIDATION_ERROR",
    );
  }

  return value;
}

async function loadWorkspacePlan(database: Db, workspaceId: string): Promise<WorkspacePlan> {
  const [row] = await database
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!row) {
    throw new RepositoryError("Workspace not found", 404, "NOT_FOUND");
  }

  return parseWorkspacePlan(row.plan);
}

async function assertCanEnableRepository(
  database: Db,
  workspaceId: string,
  repoId: string,
): Promise<void> {
  try {
    await assertRepoEnableAllowed(database, workspaceId, repoId);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new RepositoryError(error.message, error.status, error.code);
    }

    throw error;
  }
}

function buildListConditions(
  workspaceId: string,
  query: ListRepositoriesQuery,
): SQL[] {
  const conditions: SQL[] = [eq(repositories.workspaceId, workspaceId)];

  if (query.enabled !== undefined) {
    conditions.push(eq(repositories.enabled, query.enabled));
  }

  if (query.integration_id !== undefined) {
    conditions.push(eq(repositories.integrationId, query.integration_id));
  }

  return conditions;
}

/** List workspace repositories with optional filters. */
export async function listWorkspaceRepositories(
  database: Db,
  workspaceId: string,
  query: ListRepositoriesQuery = {},
): Promise<RepositorySummary[]> {
  const rows = await database
    .select()
    .from(repositories)
    .where(and(...buildListConditions(workspaceId, query)))
    .orderBy(repositories.fullName);

  return rows.map((row) => toRepositorySummary(row));
}

/** Fetch a single workspace repository by id. */
export async function getWorkspaceRepository(
  database: Db,
  workspaceId: string,
  repoId: string,
): Promise<RepositorySummary | null> {
  const [row] = await database
    .select()
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.id, repoId)))
    .limit(1);

  if (!row) {
    return null;
  }

  return toRepositorySummary(row);
}

/** Update repository sync settings (PRD §7, pages B5). */
export async function updateWorkspaceRepository(
  database: Db,
  workspaceId: string,
  repoId: string,
  input: UpdateRepositoryInput,
  options?: UpdateRepositoryOptions,
): Promise<RepositorySummary> {
  const [existing] = await database
    .select()
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.id, repoId)))
    .limit(1);

  if (!existing) {
    throw new RepositoryError("Repository not found", 404, "NOT_FOUND");
  }

  const plan = await loadWorkspacePlan(database, workspaceId);
  const nextEnabled = input.enabled ?? existing.enabled;

  if (!existing.enabled && nextEnabled) {
    await assertCanEnableRepository(database, workspaceId, repoId);
  }

  const pollingIntervalSeconds = validatePollingIntervalSeconds(input.polling_interval_seconds);
  const retentionDays = validateRetentionDays(plan, input.retention_days);

  const updates: Partial<typeof repositories.$inferInsert> = {};

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  if (pollingIntervalSeconds !== undefined) {
    updates.pollingIntervalSeconds = pollingIntervalSeconds;
  }

  if (retentionDays !== undefined) {
    updates.retentionDays = retentionDays;
  }

  if (Object.keys(updates).length === 0) {
    return toRepositorySummary(existing);
  }

  const [updated] = await database
    .update(repositories)
    .set(updates)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.id, repoId)))
    .returning();

  if (!updated) {
    throw new RepositoryError("Failed to update repository", 500, "INTERNAL_ERROR");
  }

  if (options?.syncPollingLifecycle) {
    await options.syncPollingLifecycle(
      toRepositoryPollingState(updated),
      toRepositoryPollingState(existing),
    );
  }

  return toRepositorySummary(updated);
}

/** Delete a repository and cascade pipeline data (PRD §7). */
export async function deleteWorkspaceRepository(
  database: Db,
  workspaceId: string,
  repoId: string,
): Promise<void> {
  const [deleted] = await database
    .delete(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.id, repoId)))
    .returning({ id: repositories.id });

  if (!deleted) {
    throw new RepositoryError("Repository not found", 404, "NOT_FOUND");
  }
}

/** Count enabled repositories in a workspace — used in tests. */
export async function countWorkspaceEnabledRepositories(
  database: Db,
  workspaceId: string,
): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.enabled, true)));

  return row?.total ?? 0;
}

export {
  MIN_POLLING_INTERVAL_SECONDS,
  getPlanLimits,
};

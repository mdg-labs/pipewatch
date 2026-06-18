import { and, asc, eq } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { integrations, repositories } from "@pipewatch/db/schema";
import {
  BACKFILL_INTEGRATION_JOB_NAME,
  BACKFILL_REPO_JOB_NAME,
  type BackfillIntegrationJobPayload,
  type BackfillRepoJobPayload,
} from "@pipewatch/worker/queues/backfill.js";
import { getQueue, QUEUE_NAMES } from "@pipewatch/worker/queues";

/** Jobs enqueued within this window still count as in-progress when last_synced_at is null (PRD §13). */
export const RECENT_BACKFILL_ENQUEUE_MS = 30 * 60 * 1000;

export type BackfillJobSnapshot = {
  integrationJobs: Array<{
    integrationId: string;
    workspaceId: string;
    enqueuedAt: number;
    pending: boolean;
  }>;
  repoJobs: Array<{
    repoId: string;
    workspaceId: string;
    integrationId: string;
    enqueuedAt: number;
    pending: boolean;
  }>;
};

export type SyncStatusRepo = {
  id: string;
  enabled: boolean;
  last_synced_at: string | null;
  backfill_in_progress: boolean;
};

export type SyncStatusIntegration = {
  id: string;
  enabled: boolean;
  last_synced_at: string | null;
  backfill_in_progress: boolean;
  repos: SyncStatusRepo[];
};

export type WorkspaceSyncStatus = {
  integrations: SyncStatusIntegration[];
};

export type ListBackfillJobs = (
  redisUrl: string,
  workspaceId: string,
) => Promise<BackfillJobSnapshot>;

type BackfillJobPayload = BackfillIntegrationJobPayload | BackfillRepoJobPayload;

function isRecentEnqueue(enqueuedAt: number, nowMs: number): boolean {
  return nowMs - enqueuedAt <= RECENT_BACKFILL_ENQUEUE_MS;
}

function latestSyncedAt(values: Array<Date | null>): Date | null {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (!latest || value.getTime() > latest.getTime()) {
      latest = value;
    }
  }

  return latest;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function isRepoBackfillInProgress(
  repo: { id: string; enabled: boolean; lastSyncedAt: Date | null },
  repoJobs: BackfillJobSnapshot["repoJobs"],
  nowMs: number,
): boolean {
  const matchingJobs = repoJobs.filter((job) => job.repoId === repo.id);

  if (matchingJobs.some((job) => job.pending)) {
    return true;
  }

  if (!repo.enabled || repo.lastSyncedAt !== null) {
    return false;
  }

  return matchingJobs.some((job) => isRecentEnqueue(job.enqueuedAt, nowMs));
}

function isIntegrationBackfillInProgress(
  integrationId: string,
  integrationJobs: BackfillJobSnapshot["integrationJobs"],
  repoStatuses: SyncStatusRepo[],
  nowMs: number,
): boolean {
  const matchingJobs = integrationJobs.filter((job) => job.integrationId === integrationId);

  if (matchingJobs.some((job) => job.pending)) {
    return true;
  }

  if (matchingJobs.some((job) => isRecentEnqueue(job.enqueuedAt, nowMs))) {
    return true;
  }

  return repoStatuses.some((repo) => repo.backfill_in_progress);
}

type BackfillJobRecord = {
  name: string;
  timestamp: number;
  data: BackfillJobPayload;
};

function mapJobSnapshot(
  pendingJobs: BackfillJobRecord[],
  recentCompletedJobs: BackfillJobRecord[],
  workspaceId: string,
  nowMs: number,
): BackfillJobSnapshot {
  const integrationJobs: BackfillJobSnapshot["integrationJobs"] = [];
  const repoJobs: BackfillJobSnapshot["repoJobs"] = [];

  const appendJob = (job: BackfillJobRecord, pending: boolean) => {
    if (job.data.workspaceId !== workspaceId) {
      return;
    }

    if (job.name === BACKFILL_INTEGRATION_JOB_NAME) {
      integrationJobs.push({
        integrationId: job.data.integrationId,
        workspaceId: job.data.workspaceId,
        enqueuedAt: job.timestamp,
        pending,
      });
      return;
    }

    if (job.name === BACKFILL_REPO_JOB_NAME) {
      const payload = job.data as BackfillRepoJobPayload;
      repoJobs.push({
        repoId: payload.repoId,
        workspaceId: payload.workspaceId,
        integrationId: payload.integrationId,
        enqueuedAt: job.timestamp,
        pending,
      });
    }
  };

  for (const job of pendingJobs) {
    appendJob(job, true);
  }

  for (const job of recentCompletedJobs) {
    if (!isRecentEnqueue(job.timestamp, nowMs)) {
      continue;
    }

    appendJob(job, false);
  }

  return { integrationJobs, repoJobs };
}

/** List pending backfill jobs for a workspace from BullMQ (PRD §18). */
export async function listPendingBackfillJobs(
  redisUrl: string,
  workspaceId: string,
  now: Date = new Date(),
): Promise<BackfillJobSnapshot> {
  const queue = getQueue(QUEUE_NAMES.BACKFILL, redisUrl);
  const nowMs = now.getTime();
  const [pendingJobs, completedJobs] = await Promise.all([
    queue.getJobs(["active", "waiting", "delayed"]),
    queue.getJobs(["completed"], 0, 200),
  ]);

  return mapJobSnapshot(
    pendingJobs as BackfillJobRecord[],
    completedJobs as BackfillJobRecord[],
    workspaceId,
    nowMs,
  );
}

export type GetWorkspaceSyncStatusOptions = {
  integrationId?: string;
  redisUrl?: string;
  listBackfillJobs?: ListBackfillJobs;
  now?: Date;
};

/** Build per-integration and per-repo sync/backfill status for a workspace (PRD §13, pages B2/B10). */
export async function getWorkspaceSyncStatus(
  db: Db,
  workspaceId: string,
  options: GetWorkspaceSyncStatusOptions = {},
): Promise<WorkspaceSyncStatus> {
  const nowMs = (options.now ?? new Date()).getTime();
  const integrationFilter = options.integrationId
    ? and(eq(integrations.workspaceId, workspaceId), eq(integrations.id, options.integrationId))
    : eq(integrations.workspaceId, workspaceId);

  const integrationRows = await db
    .select({
      id: integrations.id,
    })
    .from(integrations)
    .where(integrationFilter)
    .orderBy(asc(integrations.createdAt));

  const repoRows = await db
    .select({
      id: repositories.id,
      integrationId: repositories.integrationId,
      enabled: repositories.enabled,
      lastSyncedAt: repositories.lastSyncedAt,
    })
    .from(repositories)
    .where(eq(repositories.workspaceId, workspaceId))
    .orderBy(asc(repositories.fullName));

  const filteredRepoRows = options.integrationId
    ? repoRows.filter((row) => row.integrationId === options.integrationId)
    : repoRows;

  const jobSnapshot = options.listBackfillJobs
    ? await options.listBackfillJobs(options.redisUrl ?? "", workspaceId)
    : options.redisUrl
      ? await listPendingBackfillJobs(options.redisUrl, workspaceId, options.now)
      : { integrationJobs: [], repoJobs: [] };

  const reposByIntegration = new Map<string, typeof filteredRepoRows>();

  for (const row of filteredRepoRows) {
    const existing = reposByIntegration.get(row.integrationId) ?? [];
    existing.push(row);
    reposByIntegration.set(row.integrationId, existing);
  }

  const integrationsStatus = integrationRows.map((integration) => {
    const reposForIntegration = reposByIntegration.get(integration.id) ?? [];

    const repos: SyncStatusRepo[] = reposForIntegration.map((repo) => ({
      id: repo.id,
      enabled: repo.enabled,
      last_synced_at: toIso(repo.lastSyncedAt),
      backfill_in_progress: isRepoBackfillInProgress(repo, jobSnapshot.repoJobs, nowMs),
    }));

    const integrationLastSyncedAt = latestSyncedAt(reposForIntegration.map((repo) => repo.lastSyncedAt));

    return {
      id: integration.id,
      enabled: repos.some((repo) => repo.enabled),
      last_synced_at: toIso(integrationLastSyncedAt),
      backfill_in_progress: isIntegrationBackfillInProgress(
        integration.id,
        jobSnapshot.integrationJobs,
        repos,
        nowMs,
      ),
      repos,
    };
  });

  return { integrations: integrationsStatus };
}

import type { Job } from "bullmq";

import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import {
  POLL_REPO_JOB_NAME,
  type PollRepoJobPayload,
} from "../queues/polling.js";
import {
  fetchWorkflowRunsPage,
  gitHubAppConfigFromWorkerEnv,
  ingestWorkflowRuns,
  loadIntegrationRecord,
  loadRepositoryRecord,
  loadWorkspaceRetentionContext,
  markRepositorySynced,
  resolveEffectiveRetentionDays,
  retentionCreatedSince,
} from "../services/github/backfill.js";
import { resolveEffectivePollingIntervalSeconds } from "../services/polling/lifecycle.js";

export { POLL_REPO_JOB_NAME };

export type PollRepoDeps = {
  db: Db;
  env: WorkerEnv;
  fetchImpl?: typeof fetch;
};

function resolvePollCreatedSince(
  lastSyncedAt: Date | null,
  retentionDays: number,
): string {
  const retentionCutoff = new Date(retentionCreatedSince(retentionDays) + "T00:00:00.000Z");
  const since =
    lastSyncedAt && lastSyncedAt > retentionCutoff ? lastSyncedAt : retentionCutoff;
  return since.toISOString().slice(0, 10);
}

/** Incremental poll — fetch latest workflow runs since `last_synced_at` (PRD §18). */
export async function pollRepo(
  job: Job<PollRepoJobPayload>,
  deps: PollRepoDeps,
): Promise<{ runsIngested: number }> {
  const { repoId, workspaceId, integrationId } = job.data;

  const repository = await loadRepositoryRecord(deps.db, repoId, workspaceId);
  if (!repository.enabled) {
    return { runsIngested: 0 };
  }

  const interval = resolveEffectivePollingIntervalSeconds(
    repository.pollingIntervalSeconds,
    deps.env.PIPEWATCH_MODE,
  );
  if (interval === null) {
    return { runsIngested: 0 };
  }

  const integration = await loadIntegrationRecord(deps.db, integrationId, workspaceId);
  const workspace = await loadWorkspaceRetentionContext(deps.db, workspaceId);
  const retentionDays = resolveEffectiveRetentionDays(
    repository.retentionDays,
    workspace.defaultRetentionDays,
    workspace.plan,
    deps.env.RETENTION_DAYS,
  );
  const createdSince = resolvePollCreatedSince(repository.lastSyncedAt, retentionDays);

  const config = gitHubAppConfigFromWorkerEnv(deps.env);
  const fetchDeps = {
    database: deps.db,
    config,
    integration,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  };

  const response = await fetchWorkflowRunsPage(repository.fullName, 1, createdSince, fetchDeps);
  const runsIngested = await ingestWorkflowRuns(deps.db, response.workflow_runs, {
    workspaceId,
    repoId,
  });

  if (runsIngested > 0) {
    await markRepositorySynced(deps.db, repoId, new Date());
  }

  return { runsIngested };
}

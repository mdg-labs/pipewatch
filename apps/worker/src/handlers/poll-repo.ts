import type { Job } from "bullmq";

import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import {
  POLL_REPO_JOB_NAME,
  type PollRepoJobPayload,
} from "../queues/polling.js";
import {
  fetchWorkflowRunsPage,
  formatCreatedSinceFilter,
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

/** GitHub `created` filter — date-only at retention boundary, ISO datetime when incremental (audit §6). */
export function resolvePollCreatedSince(
  lastSyncedAt: Date | null,
  retentionDays: number,
): string {
  const retentionCutoff = new Date(retentionCreatedSince(retentionDays) + "T00:00:00.000Z");

  if (lastSyncedAt && lastSyncedAt > retentionCutoff) {
    return lastSyncedAt.toISOString();
  }

  return retentionCreatedSince(retentionDays);
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

  let page = 1;
  let runsIngested = 0;

  while (true) {
    const response = await fetchWorkflowRunsPage(
      repository.fullName,
      page,
      formatCreatedSinceFilter(createdSince),
      fetchDeps,
    );
    const batch = response.workflow_runs;

    if (batch.length === 0) {
      break;
    }

    runsIngested += await ingestWorkflowRuns(deps.db, batch, {
      workspaceId,
      repoId,
      fullName: repository.fullName,
    }, fetchDeps);

    if (batch.length < 100) {
      break;
    }

    page += 1;
  }

  await markRepositorySynced(deps.db, repoId, new Date());

  return { runsIngested };
}

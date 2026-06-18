import type { Job } from "bullmq";

import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import {
  BACKFILL_REPO_JOB_NAME,
  type BackfillRepoJobPayload,
} from "../queues/backfill.js";
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

export { BACKFILL_REPO_JOB_NAME };

type BackfillRepoCursor = BackfillRepoJobPayload & {
  runsPage?: number;
};

export type BackfillRepoDeps = {
  db: Db;
  env: WorkerEnv;
  fetchImpl?: typeof fetch;
};

/** Paginated workflow run history fetch for one repo — respects retention and updates last_synced_at (PRD §18). */
export async function backfillRepo(
  job: Job<BackfillRepoCursor>,
  deps: BackfillRepoDeps,
): Promise<{ runsIngested: number }> {
  const { repoId, workspaceId, integrationId } = job.data;
  const startPage = job.data.runsPage ?? 1;

  const repository = await loadRepositoryRecord(deps.db, repoId, workspaceId);
  if (!repository.enabled) {
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
  const createdSince = retentionCreatedSince(retentionDays);

  const config = gitHubAppConfigFromWorkerEnv(deps.env);
  const fetchDeps = {
    database: deps.db,
    config,
    integration,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  };

  let page = startPage;
  let runsIngested = 0;

  while (true) {
    const response = await fetchWorkflowRunsPage(
      repository.fullName,
      page,
      createdSince,
      fetchDeps,
    );
    const batch = response.workflow_runs;

    if (batch.length === 0) {
      break;
    }

    runsIngested += await ingestWorkflowRuns(deps.db, batch, {
      workspaceId,
      repoId,
    });

    if (batch.length < 100) {
      break;
    }

    page += 1;
    await job.updateData({ repoId, workspaceId, integrationId, runsPage: page });
  }

  await markRepositorySynced(deps.db, repoId, new Date());
  await job.updateData({ repoId, workspaceId, integrationId });

  return { runsIngested };
}

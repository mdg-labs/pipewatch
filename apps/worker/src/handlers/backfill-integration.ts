import type { Job } from "bullmq";

import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import {
  BACKFILL_INTEGRATION_JOB_NAME,
  type BackfillIntegrationJobPayload,
  type BackfillRepoJobPayload,
  enqueueBackfillRepo,
} from "../queues/backfill.js";
import {
  fetchInstallationRepositoriesPage,
  gitHubAppConfigFromWorkerEnv,
  loadIntegrationRecord,
  upsertDiscoveredRepository,
} from "../services/github/backfill.js";

export { BACKFILL_INTEGRATION_JOB_NAME };

type BackfillIntegrationCursor = BackfillIntegrationJobPayload & {
  reposPage?: number;
};

export type BackfillIntegrationDeps = {
  db: Db;
  env: WorkerEnv;
  fetchImpl?: typeof fetch;
  enqueueBackfillRepo?: (payload: BackfillRepoJobPayload) => Promise<void>;
};

/** Discover installation repos via paginated GitHub REST and enqueue per-repo backfill (PRD §12.1, §18). */
export async function backfillIntegration(
  job: Job<BackfillIntegrationCursor>,
  deps: BackfillIntegrationDeps,
): Promise<{ reposDiscovered: number; reposEnqueued: number }> {
  const { integrationId, workspaceId } = job.data;
  const startPage = job.data.reposPage ?? 1;

  const integration = await loadIntegrationRecord(deps.db, integrationId, workspaceId);
  const config = gitHubAppConfigFromWorkerEnv(deps.env);
  const fetchDeps = {
    database: deps.db,
    config,
    integration,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  };

  let page = startPage;
  let reposDiscovered = 0;
  let reposEnqueued = 0;
  const enqueueRepo =
    deps.enqueueBackfillRepo ??
    (async (payload: BackfillRepoJobPayload) => {
      const redisUrl = deps.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error("REDIS_URL is required to enqueue backfill-repo jobs");
      }
      await enqueueBackfillRepo(redisUrl, payload);
    });

  while (true) {
    const response = await fetchInstallationRepositoriesPage(page, fetchDeps);
    const batch = response.repositories;

    if (batch.length === 0) {
      break;
    }

    for (const repo of batch) {
      const row = await upsertDiscoveredRepository(deps.db, {
        workspaceId,
        integrationId,
        externalRepoId: String(repo.id),
        fullName: repo.full_name,
        private: repo.private,
      });

      reposDiscovered += 1;

      if (row.enabled) {
        await enqueueRepo({
          repoId: row.id,
          workspaceId,
          integrationId,
        });
        reposEnqueued += 1;
      }
    }

    if (batch.length < 100) {
      break;
    }

    page += 1;
    await job.updateData({ integrationId, workspaceId, reposPage: page });
  }

  await job.updateData({ integrationId, workspaceId });

  return { reposDiscovered, reposEnqueued };
}

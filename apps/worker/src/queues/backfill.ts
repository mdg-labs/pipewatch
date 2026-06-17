import type { Queue } from "bullmq";

import { closeAllQueues, defaultJobOptionsFor, getQueue, QUEUE_NAMES } from "./index.js";

export const BACKFILL_QUEUE_NAME = QUEUE_NAMES.BACKFILL;
export const BACKFILL_INTEGRATION_JOB_NAME = "backfill-integration";
export const BACKFILL_REPO_JOB_NAME = "backfill-repo";

export type BackfillIntegrationJobPayload = {
  integrationId: string;
  workspaceId: string;
};

export type BackfillRepoJobPayload = {
  repoId: string;
  workspaceId: string;
  integrationId: string;
};

type BackfillJobPayload = BackfillIntegrationJobPayload | BackfillRepoJobPayload;

function resolveBackfillQueue(redisUrl: string): Queue<BackfillJobPayload> {
  return getQueue(QUEUE_NAMES.BACKFILL, redisUrl);
}

/** Enqueue repo discovery for a new integration — full handler lands in P7-03 (#62). */
export async function enqueueBackfillIntegration(
  redisUrl: string,
  payload: BackfillIntegrationJobPayload,
): Promise<void> {
  const queue = resolveBackfillQueue(redisUrl);
  await queue.add(BACKFILL_INTEGRATION_JOB_NAME, payload, defaultJobOptionsFor(QUEUE_NAMES.BACKFILL));
}

/** Enqueue paginated run history fetch for a single repo — handler lands in P7-03 (#62). */
export async function enqueueBackfillRepo(
  redisUrl: string,
  payload: BackfillRepoJobPayload,
): Promise<void> {
  const queue = resolveBackfillQueue(redisUrl);
  await queue.add(BACKFILL_REPO_JOB_NAME, payload, defaultJobOptionsFor(QUEUE_NAMES.BACKFILL));
}

/** Reset cached queue — test helper. */
export async function closeBackfillQueue(): Promise<void> {
  await closeAllQueues();
}

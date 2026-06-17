import { Queue } from "bullmq";

export const BACKFILL_QUEUE_NAME = "backfill";
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

let backfillQueue: Queue<BackfillJobPayload> | null = null;

function resolveBackfillQueue(redisUrl: string): Queue<BackfillJobPayload> {
  if (!backfillQueue) {
    backfillQueue = new Queue<BackfillJobPayload>(BACKFILL_QUEUE_NAME, {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
    });
  }

  return backfillQueue;
}

/** Enqueue repo discovery for a new integration — full handler lands in P7-03 (#62). */
export async function enqueueBackfillIntegration(
  redisUrl: string,
  payload: BackfillIntegrationJobPayload,
): Promise<void> {
  const queue = resolveBackfillQueue(redisUrl);
  await queue.add(BACKFILL_INTEGRATION_JOB_NAME, payload, {
    attempts: 5,
  });
}

/** Enqueue paginated run history fetch for a single repo — handler lands in P7-03 (#62). */
export async function enqueueBackfillRepo(
  redisUrl: string,
  payload: BackfillRepoJobPayload,
): Promise<void> {
  const queue = resolveBackfillQueue(redisUrl);
  await queue.add(BACKFILL_REPO_JOB_NAME, payload, {
    attempts: 5,
  });
}

/** Reset cached queue — test helper. */
export async function closeBackfillQueue(): Promise<void> {
  if (backfillQueue) {
    await backfillQueue.close();
    backfillQueue = null;
  }
}

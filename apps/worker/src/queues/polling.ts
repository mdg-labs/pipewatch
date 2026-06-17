import type { Queue } from "bullmq";

import { closeAllQueues, defaultJobOptionsFor, getQueue, QUEUE_NAMES } from "./index.js";

export const POLLING_QUEUE_NAME = QUEUE_NAMES.POLLING;
export const POLL_REPO_JOB_NAME = "poll-repo";

export type PollRepoJobPayload = {
  repoId: string;
  workspaceId: string;
  integrationId: string;
};

function resolvePollingQueue(redisUrl: string): Queue<PollRepoJobPayload> {
  return getQueue(QUEUE_NAMES.POLLING, redisUrl);
}

/** BullMQ repeatable job id — PRD §18 `poll:${repoId}`. */
export function pollRepeatableJobId(repoId: string): string {
  return `poll:${repoId}`;
}

/** Enqueue a one-off poll-repo job (tests and manual triggers). */
export async function enqueuePollRepo(
  redisUrl: string,
  payload: PollRepoJobPayload,
): Promise<void> {
  const queue = resolvePollingQueue(redisUrl);
  await queue.add(POLL_REPO_JOB_NAME, payload, defaultJobOptionsFor(QUEUE_NAMES.POLLING));
}

/** Reset cached queue — test helper. */
export async function closePollingQueue(): Promise<void> {
  await closeAllQueues();
}

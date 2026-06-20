import type { Queue } from "bullmq";

import {
  ADMIN_QUEUE_NAMES,
  closeAllAdminQueues,
  defaultAdminJobOptions,
  getAdminQueue,
} from "./index.js";

export const WEBHOOK_POLL_QUEUE_NAME = ADMIN_QUEUE_NAMES.WEBHOOK_POLL;
export const WEBHOOK_POLL_JOB_NAME = "webhook-poll";
export const WEBHOOK_POLL_REPEATABLE_JOB_ID = "webhook-poll";

function resolveWebhookPollQueue(redisUrl: string): Queue {
  return getAdminQueue(WEBHOOK_POLL_QUEUE_NAME, redisUrl);
}

/** Register repeatable webhook delivery poll job (Admin PRD §9.1). */
export async function registerWebhookPollSchedule(
  redisUrl: string,
  cronPattern: string,
): Promise<void> {
  const queue = resolveWebhookPollQueue(redisUrl);
  await queue.add(
    WEBHOOK_POLL_JOB_NAME,
    {},
    {
      jobId: WEBHOOK_POLL_REPEATABLE_JOB_ID,
      repeat: { pattern: cronPattern, tz: "UTC" },
      ...defaultAdminJobOptions(),
    },
  );
}

/** Enqueue a one-off webhook poll job (tests and manual triggers). */
export async function enqueueWebhookPoll(redisUrl: string): Promise<void> {
  const queue = resolveWebhookPollQueue(redisUrl);
  await queue.add(WEBHOOK_POLL_JOB_NAME, {}, defaultAdminJobOptions());
}

/** Reset cached queue — test helper. */
export async function closeWebhookPollQueue(): Promise<void> {
  await closeAllAdminQueues();
}

import type { Queue } from "bullmq";

import { closeAllQueues, defaultJobOptionsFor, getQueue, QUEUE_NAMES } from "./index.js";

export const MAINTENANCE_QUEUE_NAME = QUEUE_NAMES.MAINTENANCE;
export const RETENTION_CLEANUP_JOB_NAME = "retention-cleanup";
export const RETENTION_CLEANUP_REPEATABLE_JOB_ID = "retention-cleanup";
export const RETENTION_CLEANUP_CRON_UTC = "0 3 * * *";
export const RETENTION_CLEANUP_BATCH_SIZE = 1000;

function resolveMaintenanceQueue(redisUrl: string): Queue {
  return getQueue(QUEUE_NAMES.MAINTENANCE, redisUrl);
}

/** Register daily 03:00 UTC repeatable retention-cleanup job (PRD §18). */
export async function registerRetentionCleanupSchedule(redisUrl: string): Promise<void> {
  const queue = resolveMaintenanceQueue(redisUrl);
  await queue.add(
    RETENTION_CLEANUP_JOB_NAME,
    {},
    {
      jobId: RETENTION_CLEANUP_REPEATABLE_JOB_ID,
      repeat: { pattern: RETENTION_CLEANUP_CRON_UTC, tz: "UTC" },
      ...defaultJobOptionsFor(QUEUE_NAMES.MAINTENANCE),
    },
  );
}

/** Enqueue a one-off retention-cleanup job (tests and manual triggers). */
export async function enqueueRetentionCleanup(redisUrl: string): Promise<void> {
  const queue = resolveMaintenanceQueue(redisUrl);
  await queue.add(
    RETENTION_CLEANUP_JOB_NAME,
    {},
    defaultJobOptionsFor(QUEUE_NAMES.MAINTENANCE),
  );
}

/** Reset cached queue — test helper. */
export async function closeMaintenanceQueue(): Promise<void> {
  await closeAllQueues();
}

import {
  closeAllAdminQueues,
  defaultAdminJobOptions,
  getAdminQueue,
  ADMIN_QUEUE_NAMES,
} from "./index.js";

export const MAINTENANCE_QUEUE_NAME = ADMIN_QUEUE_NAMES.MAINTENANCE;
export const RETENTION_CLEANUP_JOB_NAME = "retention-cleanup";
export const RETENTION_CLEANUP_REPEATABLE_JOB_ID = "retention-cleanup";
export const RETENTION_CLEANUP_CRON_UTC = "0 3 * * *";

function resolveMaintenanceQueue(redisUrl: string) {
  return getAdminQueue(MAINTENANCE_QUEUE_NAME, redisUrl);
}

/** Register daily 03:00 UTC repeatable retention cleanup (Admin PRD §9.4). */
export async function registerRetentionCleanupSchedule(
  redisUrl: string,
): Promise<void> {
  const queue = resolveMaintenanceQueue(redisUrl);
  await queue.add(
    RETENTION_CLEANUP_JOB_NAME,
    {},
    {
      jobId: RETENTION_CLEANUP_REPEATABLE_JOB_ID,
      repeat: { pattern: RETENTION_CLEANUP_CRON_UTC, tz: "UTC" },
      ...defaultAdminJobOptions(),
    },
  );
}

/** Enqueue a one-off retention cleanup job (tests and manual triggers). */
export async function enqueueRetentionCleanup(redisUrl: string): Promise<void> {
  const queue = resolveMaintenanceQueue(redisUrl);
  await queue.add(RETENTION_CLEANUP_JOB_NAME, {}, defaultAdminJobOptions());
}

/** Reset cached queue — test helper. */
export async function closeMaintenanceQueue(): Promise<void> {
  await closeAllAdminQueues();
}

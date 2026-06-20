import type { Db } from "@pipewatch/db";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { inArray, lt } from "drizzle-orm";

/** Admin webhook delivery retention — Admin PRD §7.1, §9.4. */
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 45;

export const RETENTION_CLEANUP_BATCH_SIZE = 1000;

export type RetentionCleanupDeps = {
  db: Db;
  now?: Date;
};

export type RetentionCleanupResult = {
  deleted: number;
};

function retentionCutoff(now: Date): Date {
  return new Date(
    now.getTime() - WEBHOOK_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

/** Delete one batch of webhook deliveries older than the retention window. */
export async function deleteExpiredWebhookDeliveriesBatch(
  db: Db,
  cutoff: Date,
  batchSize = RETENTION_CLEANUP_BATCH_SIZE,
): Promise<number> {
  const batch = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(lt(webhookDeliveries.deliveredAt, cutoff))
    .limit(batchSize);

  if (batch.length === 0) {
    return 0;
  }

  const ids = batch.map((row) => row.id);
  await db.delete(webhookDeliveries).where(inArray(webhookDeliveries.id, ids));

  return batch.length;
}

/** Purge `admin.webhook_deliveries` rows past the 45-day retention window. */
export async function runRetentionCleanupJob(
  deps: RetentionCleanupDeps,
): Promise<RetentionCleanupResult> {
  const now = deps.now ?? new Date();
  const cutoff = retentionCutoff(now);
  let deleted = 0;

  for (;;) {
    const batchDeleted = await deleteExpiredWebhookDeliveriesBatch(
      deps.db,
      cutoff,
    );
    deleted += batchDeleted;
    if (batchDeleted < RETENTION_CLEANUP_BATCH_SIZE) {
      break;
    }
  }

  return { deleted };
}

import type { Job } from "bullmq";
import { and, eq, inArray, lt } from "drizzle-orm";

import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { pipelineRuns, repositories, workspaces } from "@pipewatch/db/schema";

import {
  RETENTION_CLEANUP_BATCH_SIZE,
  RETENTION_CLEANUP_JOB_NAME,
} from "../queues/maintenance.js";
import { resolveEffectiveRetentionDays } from "../services/github/backfill.js";

export { RETENTION_CLEANUP_JOB_NAME };

export type RetentionCleanupDeps = {
  db: Db;
  env: WorkerEnv;
  now?: Date;
};

export type RetentionCleanupResult = {
  reposProcessed: number;
  runsDeleted: number;
};

function retentionCutoff(retentionDays: number, now: Date): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

async function deleteExpiredRunsBatch(
  database: Db,
  repoId: string,
  cutoff: Date,
  batchSize: number,
): Promise<number> {
  const batch = await database
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.repoId, repoId), lt(pipelineRuns.startedAt, cutoff)))
    .limit(batchSize);

  if (batch.length === 0) {
    return 0;
  }

  await database
    .delete(pipelineRuns)
    .where(inArray(pipelineRuns.id, batch.map((row) => row.id)));

  return batch.length;
}

/** Delete expired runs for one repo in fixed-size batches (PRD §18). */
export async function deleteExpiredRunsForRepo(
  database: Db,
  repoId: string,
  retentionDays: number,
  now: Date,
  batchSize = RETENTION_CLEANUP_BATCH_SIZE,
): Promise<number> {
  const cutoff = retentionCutoff(retentionDays, now);
  let deleted = 0;

  for (;;) {
    const batchDeleted = await deleteExpiredRunsBatch(database, repoId, cutoff, batchSize);
    deleted += batchDeleted;
    if (batchDeleted < batchSize) {
      break;
    }
  }

  return deleted;
}

/** Daily maintenance job — purge pipeline runs past per-repo retention (PRD §18). */
export async function retentionCleanup(
  _job: Job,
  deps: RetentionCleanupDeps,
): Promise<RetentionCleanupResult> {
  const now = deps.now ?? new Date();

  const repoRows = await deps.db
    .select({
      repoId: repositories.id,
      retentionDays: repositories.retentionDays,
      defaultRetentionDays: workspaces.defaultRetentionDays,
      plan: workspaces.plan,
    })
    .from(repositories)
    .innerJoin(workspaces, eq(repositories.workspaceId, workspaces.id));

  let reposProcessed = 0;
  let runsDeleted = 0;

  for (const row of repoRows) {
    const effectiveDays = resolveEffectiveRetentionDays(
      row.retentionDays,
      row.defaultRetentionDays,
      row.plan,
      deps.env.RETENTION_DAYS,
    );

    const deleted = await deleteExpiredRunsForRepo(deps.db, row.repoId, effectiveDays, now);
    reposProcessed += 1;
    runsDeleted += deleted;
  }

  return { reposProcessed, runsDeleted };
}

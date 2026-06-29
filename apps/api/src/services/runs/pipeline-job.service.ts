import { and, asc, eq } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import {
  pipelineJobs,
  pipelineRuns,
  pipelineSteps,
  repositories,
} from "@pipewatch/db/schema";
import type { PipelineJob, PipelineStep } from "@pipewatch/types";

export class PipelineJobError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PipelineJobError";
    this.status = status;
    this.code = code;
  }
}

function toPipelineJob(row: typeof pipelineJobs.$inferSelect): PipelineJob {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    run_id: row.runId,
    external_job_id: row.externalJobId,
    name: row.name,
    status: row.status as PipelineJob["status"],
    conclusion: row.conclusion as PipelineJob["conclusion"],
    runner_name: row.runnerName,
    source_url: row.sourceUrl,
    started_at: row.startedAt.toISOString(),
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    duration_ms: row.durationMs,
  };
}

function toPipelineStep(row: typeof pipelineSteps.$inferSelect): PipelineStep {
  return {
    id: row.id,
    job_id: row.jobId,
    number: row.number,
    name: row.name,
    status: row.status as PipelineStep["status"],
    conclusion: row.conclusion as PipelineStep["conclusion"],
    started_at: row.startedAt.toISOString(),
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    duration_ms: row.durationMs,
  };
}

async function assertRepositoryInWorkspace(
  database: Db,
  workspaceId: string,
  repoId: string,
): Promise<void> {
  const [row] = await database
    .select({ id: repositories.id })
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.id, repoId)))
    .limit(1);

  if (!row) {
    throw new PipelineJobError("Repository not found", 404, "NOT_FOUND");
  }
}

async function assertRunInWorkspaceRepository(
  database: Db,
  workspaceId: string,
  repoId: string,
  runId: string,
): Promise<void> {
  const [row] = await database
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.workspaceId, workspaceId),
        eq(pipelineRuns.repoId, repoId),
        eq(pipelineRuns.id, runId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new PipelineJobError("Pipeline run not found", 404, "NOT_FOUND");
  }
}

/** Jobs for a pipeline run, ordered for DAG display (PRD §7, page B6). */
export async function listWorkspacePipelineJobs(
  database: Db,
  workspaceId: string,
  repoId: string,
  runId: string,
): Promise<PipelineJob[]> {
  await assertRepositoryInWorkspace(database, workspaceId, repoId);
  await assertRunInWorkspaceRepository(database, workspaceId, repoId, runId);

  const rows = await database
    .select()
    .from(pipelineJobs)
    .where(and(eq(pipelineJobs.workspaceId, workspaceId), eq(pipelineJobs.runId, runId)))
    .orderBy(
      asc(pipelineJobs.startedAt),
      asc(pipelineJobs.name),
      asc(pipelineJobs.externalJobId),
    );

  return rows.map((row) => toPipelineJob(row));
}

/** Steps for a pipeline job, ordered by step number (PRD §7, page B6). */
export async function listWorkspacePipelineJobSteps(
  database: Db,
  workspaceId: string,
  repoId: string,
  runId: string,
  jobId: string,
): Promise<PipelineStep[]> {
  await assertRepositoryInWorkspace(database, workspaceId, repoId);
  await assertRunInWorkspaceRepository(database, workspaceId, repoId, runId);

  const [job] = await database
    .select({ id: pipelineJobs.id })
    .from(pipelineJobs)
    .innerJoin(pipelineRuns, eq(pipelineJobs.runId, pipelineRuns.id))
    .where(
      and(
        eq(pipelineJobs.id, jobId),
        eq(pipelineJobs.runId, runId),
        eq(pipelineJobs.workspaceId, workspaceId),
        eq(pipelineRuns.repoId, repoId),
        eq(pipelineRuns.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!job) {
    throw new PipelineJobError("Pipeline job not found", 404, "NOT_FOUND");
  }

  const rows = await database
    .select()
    .from(pipelineSteps)
    .where(eq(pipelineSteps.jobId, jobId))
    .orderBy(asc(pipelineSteps.number));

  return rows.map((row) => toPipelineStep(row));
}

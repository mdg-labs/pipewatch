import type { Db } from "@pipewatch/db";
import {
  pipelineJobs,
  pipelineRuns,
  pipelineSteps,
} from "@pipewatch/db/schema";
import type {
  PipelineJobUpsert,
  PipelineRunUpsert,
  PipelineStepUpsert,
} from "@pipewatch/utils";
import { and, eq } from "drizzle-orm";

type PipelineRunRow = typeof pipelineRuns.$inferSelect;
type PipelineJobRow = typeof pipelineJobs.$inferSelect;

function toRunInsert(row: PipelineRunUpsert) {
  return {
    workspaceId: row.workspaceId,
    repoId: row.repoId,
    externalRunId: row.externalRunId,
    pipelineName: row.pipelineName,
    pipelineDefinitionRef: row.pipelineDefinitionRef,
    status: row.status,
    conclusion: row.conclusion,
    branch: row.branch,
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    actorLogin: row.actorLogin,
    triggerType: row.triggerType,
    sourceUrl: row.sourceUrl,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    durationMs: row.durationMs,
  };
}

function toJobInsert(row: PipelineJobUpsert) {
  return {
    workspaceId: row.workspaceId,
    runId: row.runId,
    externalJobId: row.externalJobId,
    name: row.name,
    status: row.status,
    conclusion: row.conclusion,
    runnerName: row.runnerName,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    durationMs: row.durationMs,
  };
}

/** Upsert a pipeline run by `(repo_id, external_run_id)`. */
export async function upsertPipelineRun(
  database: Db,
  row: PipelineRunUpsert,
): Promise<PipelineRunRow> {
  const values = toRunInsert(row);

  const [upserted] = await database
    .insert(pipelineRuns)
    .values(values)
    .onConflictDoUpdate({
      target: [pipelineRuns.repoId, pipelineRuns.externalRunId],
      set: {
        workspaceId: values.workspaceId,
        pipelineName: values.pipelineName,
        pipelineDefinitionRef: values.pipelineDefinitionRef,
        status: values.status,
        conclusion: values.conclusion,
        branch: values.branch,
        commitSha: values.commitSha,
        commitMessage: values.commitMessage,
        actorLogin: values.actorLogin,
        triggerType: values.triggerType,
        sourceUrl: values.sourceUrl,
        startedAt: values.startedAt,
        completedAt: values.completedAt,
        durationMs: values.durationMs,
      },
    })
    .returning();

  if (!upserted) {
    throw new Error("Failed to upsert pipeline run");
  }

  return upserted;
}

/** Resolve a pipeline run by repository and GitHub run id. */
export async function findPipelineRunByExternalId(
  database: Db,
  repoId: string,
  externalRunId: string,
): Promise<PipelineRunRow | null> {
  const [run] = await database
    .select()
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.repoId, repoId),
        eq(pipelineRuns.externalRunId, externalRunId),
      ),
    )
    .limit(1);

  return run ?? null;
}

/** Upsert a pipeline job and replace its steps idempotently. */
export async function upsertPipelineJobAndSteps(
  database: Db,
  jobRow: PipelineJobUpsert,
  steps: PipelineStepUpsert[],
): Promise<PipelineJobRow> {
  const values = toJobInsert(jobRow);

  return database.transaction(async (tx) => {
    const [upsertedJob] = await tx
      .insert(pipelineJobs)
      .values(values)
      .onConflictDoUpdate({
        target: [pipelineJobs.runId, pipelineJobs.externalJobId],
        set: {
          workspaceId: values.workspaceId,
          name: values.name,
          status: values.status,
          conclusion: values.conclusion,
          runnerName: values.runnerName,
          startedAt: values.startedAt,
          completedAt: values.completedAt,
          durationMs: values.durationMs,
        },
      })
      .returning();

    if (!upsertedJob) {
      throw new Error("Failed to upsert pipeline job");
    }

    await tx
      .delete(pipelineSteps)
      .where(eq(pipelineSteps.jobId, upsertedJob.id));

    if (steps.length > 0) {
      await tx.insert(pipelineSteps).values(
        steps.map((step) => ({
          jobId: upsertedJob.id,
          number: step.number,
          name: step.name,
          status: step.status,
          conclusion: step.conclusion,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          durationMs: step.durationMs,
        })),
      );
    }

    return upsertedJob;
  });
}

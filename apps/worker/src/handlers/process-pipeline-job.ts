import type { Db } from "@pipewatch/db";
import type { PipelineConclusion, PipelineJobSummary, PipelineStatus } from "@pipewatch/types";
import {
  mapWorkflowJobPayload,
  type GitHubWorkflowJobWebhookPayload,
} from "@pipewatch/utils";

import {
  findPipelineRunByExternalId,
  upsertPipelineJobAndSteps,
} from "../services/pipeline-upsert.js";
import {
  publishSseEvent,
  type PublishSseEventInput,
} from "../services/sse-publish.js";

export const PROCESS_PIPELINE_JOB_JOB_NAME = "process-pipeline-job";

export type ProcessPipelineJobJobPayload = {
  workspaceId: string;
  repoId: string;
  action: string;
  payload: GitHubWorkflowJobWebhookPayload;
};

export type ProcessPipelineJobDeps = {
  db: Db;
  publishSse?: (input: PublishSseEventInput) => Promise<void>;
};

function toJobSummary(job: {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  durationMs: number | null;
}): PipelineJobSummary {
  return {
    id: job.id,
    name: job.name,
    status: job.status as PipelineStatus,
    conclusion: job.conclusion as PipelineConclusion,
    durationMs: job.durationMs,
  };
}

/** Consume a `workflow_job` webhook job — map, upsert job + steps, publish SSE stub. */
export async function processPipelineJob(
  data: ProcessPipelineJobJobPayload,
  deps: ProcessPipelineJobDeps,
): Promise<{ jobId: string }> {
  const externalRunId = String(data.payload.workflow_job.run_id);
  const run = await findPipelineRunByExternalId(deps.db, data.repoId, externalRunId);

  if (!run) {
    throw new Error(
      `Pipeline run not found for repo ${data.repoId} and external run id ${externalRunId}`,
    );
  }

  const mapped = mapWorkflowJobPayload(data.payload, {
    workspaceId: data.workspaceId,
    runId: run.id,
  });

  const job = await upsertPipelineJobAndSteps(deps.db, mapped.job, mapped.steps);
  const publish = deps.publishSse ?? publishSseEvent;

  await publish({
    workspaceId: data.workspaceId,
    repoId: data.repoId,
    type: "job:updated",
    data: toJobSummary(job),
  });

  return { jobId: job.id };
}

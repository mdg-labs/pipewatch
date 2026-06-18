import * as Sentry from "@sentry/node";
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
} from "../lib/sse-publish.js";
import { claimWebhookDeliveryForSse } from "../lib/webhook-delivery-idempotency.js";

export const PROCESS_PIPELINE_JOB_JOB_NAME = "process-pipeline-job";

/** Extended defer attempts after the queue's quick retries (1s / 5s / 30s) are exhausted. */
export const PARENT_RUN_DEFER_MAX_ATTEMPTS = 5;
export const PARENT_RUN_DEFER_DELAY_MS = 60_000;

export type ProcessPipelineJobJobPayload = {
  workspaceId: string;
  repoId: string;
  action: string;
  payload: GitHubWorkflowJobWebhookPayload;
  deliveryId?: string;
  /** Count of extended deferrals after quick queue retries (worker-managed). */
  parentRunDeferCount?: number;
};

export type ProcessPipelineJobDeps = {
  db: Db;
  publishSse?: (input: PublishSseEventInput) => Promise<void>;
  redisUrl?: string;
};

/** Thrown when `workflow_job` arrives before its parent `workflow_run` has been upserted. */
export class ParentRunNotFoundError extends Error {
  readonly code = "PARENT_RUN_NOT_FOUND";

  constructor(repoId: string, externalRunId: string) {
    super(
      `Pipeline run not found for repo ${repoId} and external run id ${externalRunId}`,
    );
    this.name = "ParentRunNotFoundError";
  }
}

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

function logUnknownGitHubStatus(status: string): void {
  Sentry.captureMessage(`Unknown GitHub Actions status: ${status}`, {
    level: "warning",
    tags: { component: "process-pipeline-job" },
  });
}

/** Consume a `workflow_job` webhook job — map, upsert job + steps, publish SSE stub. */
export async function processPipelineJob(
  data: ProcessPipelineJobJobPayload,
  deps: ProcessPipelineJobDeps,
): Promise<{ jobId: string }> {
  const externalRunId = String(data.payload.workflow_job.run_id);
  const run = await findPipelineRunByExternalId(deps.db, data.repoId, externalRunId);

  if (!run) {
    throw new ParentRunNotFoundError(data.repoId, externalRunId);
  }

  const mapped = mapWorkflowJobPayload(data.payload, {
    workspaceId: data.workspaceId,
    runId: run.id,
    onUnknownStatus: logUnknownGitHubStatus,
  });

  const job = await upsertPipelineJobAndSteps(deps.db, mapped.job, mapped.steps);

  const shouldPublish = await claimWebhookDeliveryForSse(
    data.deliveryId,
    deps.redisUrl ?? process.env.REDIS_URL,
  );

  if (shouldPublish) {
    const publish = deps.publishSse ?? publishSseEvent;
    await publish({
      workspaceId: data.workspaceId,
      repoId: data.repoId,
      type: "job:updated",
      data: toJobSummary(job),
    });
  }

  return { jobId: job.id };
}

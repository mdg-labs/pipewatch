import * as Sentry from "@sentry/node";
import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import type {
  PipelineConclusion,
  PipelineJobSummary,
  PipelineRunSummary,
  PipelineStatus,
  SseEventType,
} from "@pipewatch/types";
import {
  mapWorkflowRunPayload,
  type GitHubWorkflowRunWebhookPayload,
} from "@pipewatch/utils";

import {
  gitHubAppConfigFromWorkerEnv,
  ingestWorkflowJobsForRun,
  loadIntegrationRecord,
  loadRepositoryRecord,
  type PipelineJobRow,
} from "../services/github/backfill.js";
import { upsertPipelineRun } from "../services/pipeline-upsert.js";
import {
  publishSseEvent,
  type PublishSseEventInput,
} from "../lib/sse-publish.js";
import { claimWebhookDeliveryForSse } from "../lib/webhook-delivery-idempotency.js";

export const PROCESS_PIPELINE_RUN_JOB_NAME = "process-pipeline-run";

export type ProcessPipelineRunJobPayload = {
  workspaceId: string;
  repoId: string;
  action: string;
  payload: GitHubWorkflowRunWebhookPayload;
  deliveryId?: string;
};

export type ProcessPipelineRunDeps = {
  db: Db;
  env?: WorkerEnv;
  publishSse?: (input: PublishSseEventInput) => Promise<void>;
  redisUrl?: string;
  fetchImpl?: typeof fetch;
};

function toRunSummary(run: {
  id: string;
  pipelineName: string;
  status: string;
  conclusion: string | null;
  branch: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}): PipelineRunSummary {
  return {
    id: run.id,
    pipelineName: run.pipelineName,
    status: run.status as PipelineStatus,
    conclusion: run.conclusion as PipelineConclusion,
    branch: run.branch,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
  };
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

function resolveRunSseEventType(action: string): SseEventType {
  switch (action) {
    case "requested":
    case "created":
      return "run:created";
    case "completed":
      return "run:completed";
    default:
      return "run:updated";
  }
}

function logUnknownGitHubStatus(status: string): void {
  Sentry.captureMessage(`Unknown GitHub Actions status: ${status}`, {
    level: "warning",
    tags: { component: "process-pipeline-run" },
  });
}

async function reconcileJobsOnRunCompleted(
  data: ProcessPipelineRunJobPayload,
  runId: string,
  deps: ProcessPipelineRunDeps,
): Promise<PipelineJobRow[]> {
  if (!deps.env) {
    return [];
  }

  const repository = await loadRepositoryRecord(
    deps.db,
    data.repoId,
    data.workspaceId,
  );
  const integration = await loadIntegrationRecord(
    deps.db,
    repository.integrationId,
    data.workspaceId,
  );
  const config = gitHubAppConfigFromWorkerEnv(deps.env);
  const fetchDeps = {
    database: deps.db,
    config,
    integration,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  };

  const externalRunId = String(data.payload.workflow_run.id);
  const { changedJobs } = await ingestWorkflowJobsForRun(
    deps.db,
    repository.fullName,
    externalRunId,
    runId,
    data.workspaceId,
    fetchDeps,
  );

  return changedJobs;
}

/** Consume a `workflow_run` webhook job — map, upsert, publish SSE stub. */
export async function processPipelineRun(
  data: ProcessPipelineRunJobPayload,
  deps: ProcessPipelineRunDeps,
): Promise<{ runId: string }> {
  const action = data.action || data.payload.action;
  const mapped = mapWorkflowRunPayload(data.payload, {
    workspaceId: data.workspaceId,
    repoId: data.repoId,
    onUnknownStatus: logUnknownGitHubStatus,
  });

  const run = await upsertPipelineRun(deps.db, mapped);

  const changedJobs =
    action === "completed"
      ? await reconcileJobsOnRunCompleted(data, run.id, deps)
      : [];

  const shouldPublish = await claimWebhookDeliveryForSse(
    data.deliveryId,
    deps.redisUrl ?? process.env.REDIS_URL,
  );

  if (shouldPublish) {
    const publish = deps.publishSse ?? publishSseEvent;
    await publish({
      workspaceId: data.workspaceId,
      repoId: data.repoId,
      type: resolveRunSseEventType(action),
      data: toRunSummary(run),
    });

    for (const job of changedJobs) {
      await publish({
        workspaceId: data.workspaceId,
        repoId: data.repoId,
        type: "job:updated",
        data: toJobSummary(job),
      });
    }
  }

  return { runId: run.id };
}

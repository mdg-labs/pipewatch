import * as Sentry from "@sentry/node";
import type { Db } from "@pipewatch/db";
import type { PipelineConclusion, PipelineRunSummary, PipelineStatus, SseEventType } from "@pipewatch/types";
import {
  mapWorkflowRunPayload,
  type GitHubWorkflowRunWebhookPayload,
} from "@pipewatch/utils";

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
  publishSse?: (input: PublishSseEventInput) => Promise<void>;
  redisUrl?: string;
};

function toRunSummary(run: {
  id: string;
  pipelineName: string;
  status: string;
  conclusion: string | null;
  branch: string;
  startedAt: Date;
  durationMs: number | null;
}): PipelineRunSummary {
  return {
    id: run.id,
    pipelineName: run.pipelineName,
    status: run.status as PipelineStatus,
    conclusion: run.conclusion as PipelineConclusion,
    branch: run.branch,
    startedAt: run.startedAt.toISOString(),
    durationMs: run.durationMs,
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
  }

  return { runId: run.id };
}

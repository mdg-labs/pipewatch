import type { PipelineConclusion, PipelineStatus } from "@pipewatch/types";

import {
  computeDurationMs,
  mapGitHubConclusion,
  mapGitHubStatus,
  parseGitHubTimestamp,
} from "./github-status.js";

/** GitHub `workflow_job` webhook payload (subset used for mapping). */
export interface GitHubWorkflowJobWebhookPayload {
  action: string;
  workflow_job: GitHubWorkflowJob;
}

export interface GitHubWorkflowJobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface GitHubWorkflowJob {
  id: number;
  run_id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  html_url: string;
  runner_name: string | null;
  steps?: GitHubWorkflowJobStep[] | null;
}

/** Canonical `pipeline_jobs` insert/upsert shape (excludes generated `id`). */
export interface PipelineJobUpsert {
  workspaceId: string;
  runId: string;
  externalJobId: string;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  runnerName: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

/** Canonical `pipeline_steps` insert shape (excludes generated `id` and `job_id`). */
export interface PipelineStepUpsert {
  number: number;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface MapWorkflowJobResult {
  job: PipelineJobUpsert;
  steps: PipelineStepUpsert[];
}

export interface MapWorkflowJobContext {
  workspaceId: string;
  runId: string;
  onUnknownStatus?: (status: string) => void;
}

function mapWorkflowJobStep(
  step: GitHubWorkflowJobStep,
  jobStartedAt: Date,
  onUnknownStatus?: (status: string) => void,
): PipelineStepUpsert {
  const status = mapGitHubStatus(
    step.status,
    onUnknownStatus ? { onUnknown: onUnknownStatus } : undefined,
  );
  const conclusion = mapGitHubConclusion(step.conclusion, step.status);

  const startedAt = step.started_at
    ? parseGitHubTimestamp(step.started_at)
    : jobStartedAt;
  const completedAt =
    status === "completed" && step.completed_at
      ? parseGitHubTimestamp(step.completed_at)
      : null;

  return {
    number: step.number,
    name: step.name,
    status,
    conclusion,
    startedAt,
    completedAt,
    durationMs: computeDurationMs(startedAt, completedAt),
  };
}

/**
 * Map a GitHub REST workflow job object to canonical job + step upsert shapes.
 * REST list-jobs responses use the same job object shape as webhook payloads.
 * @see https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28#list-jobs-for-a-workflow-run
 */
export function mapRestWorkflowJob(
  job: GitHubWorkflowJob,
  context: MapWorkflowJobContext,
): MapWorkflowJobResult {
  return mapWorkflowJobPayload({ action: "completed", workflow_job: job }, context);
}

/**
 * Map a GitHub `workflow_job` webhook payload to canonical job + step upsert shapes.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job
 */
export function mapWorkflowJobPayload(
  payload: GitHubWorkflowJobWebhookPayload,
  context: MapWorkflowJobContext,
): MapWorkflowJobResult {
  const job = payload.workflow_job;
  const status = mapGitHubStatus(
    job.status,
    context.onUnknownStatus ? { onUnknown: context.onUnknownStatus } : undefined,
  );
  const conclusion = mapGitHubConclusion(job.conclusion, job.status);

  const startedAt = parseGitHubTimestamp(job.started_at);
  const completedAt =
    status === "completed" && job.completed_at
      ? parseGitHubTimestamp(job.completed_at)
      : null;

  const jobUpsert: PipelineJobUpsert = {
    workspaceId: context.workspaceId,
    runId: context.runId,
    externalJobId: String(job.id),
    name: job.name,
    status,
    conclusion,
    runnerName: job.runner_name,
    startedAt,
    completedAt,
    durationMs: computeDurationMs(startedAt, completedAt),
  };

  const steps = (job.steps ?? []).map((step) =>
    mapWorkflowJobStep(step, startedAt, context.onUnknownStatus),
  );

  return { job: jobUpsert, steps };
}

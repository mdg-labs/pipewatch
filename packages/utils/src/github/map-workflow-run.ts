import type { PipelineConclusion, PipelineStatus } from "@pipewatch/types";

import {
  computeDurationMs,
  mapGitHubConclusion,
  mapGitHubStatus,
  parseGitHubTimestamp,
} from "./github-status.js";

/** GitHub `workflow_run` webhook payload (subset used for mapping). */
export interface GitHubWorkflowRunWebhookPayload {
  action: string;
  workflow_run: GitHubWorkflowRun;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  path: string;
  status: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  event: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  head_commit?: {
    message?: string | null;
  } | null;
  actor?: {
    login?: string | null;
  } | null;
}

/** Canonical `pipeline_runs` insert/upsert shape (excludes generated `id` / `created_at`). */
export interface PipelineRunUpsert {
  workspaceId: string;
  repoId: string;
  externalRunId: string;
  pipelineName: string;
  pipelineDefinitionRef: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  branch: string;
  commitSha: string;
  commitMessage: string | null;
  actorLogin: string | null;
  triggerType: string;
  sourceUrl: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface MapWorkflowRunContext {
  workspaceId: string;
  repoId: string;
}

/**
 * Map a GitHub `workflow_run` webhook payload to a canonical pipeline run upsert shape.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_run
 */
export function mapWorkflowRunPayload(
  payload: GitHubWorkflowRunWebhookPayload,
  context: MapWorkflowRunContext,
): PipelineRunUpsert {
  const run = payload.workflow_run;
  const status = mapGitHubStatus(run.status);
  const conclusion = mapGitHubConclusion(run.conclusion, run.status);

  const startedAt = parseGitHubTimestamp(
    run.run_started_at ?? run.created_at,
  );
  const completedAt =
    status === "completed" ? parseGitHubTimestamp(run.updated_at) : null;

  return {
    workspaceId: context.workspaceId,
    repoId: context.repoId,
    externalRunId: String(run.id),
    pipelineName: run.name,
    pipelineDefinitionRef: run.path,
    status,
    conclusion,
    branch: run.head_branch,
    commitSha: run.head_sha,
    commitMessage: run.head_commit?.message ?? null,
    actorLogin: run.actor?.login ?? null,
    triggerType: run.event,
    sourceUrl: run.html_url,
    startedAt,
    completedAt,
    durationMs: computeDurationMs(startedAt, completedAt),
  };
}

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

/** Stored when GitHub returns a null `workflow_run.head_branch`. */
export const PIPELINE_NO_BRANCH_LABEL = "(no branch)" as const;

/** Stored when GitHub returns a null `workflow_run.name` and `path` has no workflow file. */
export const PIPELINE_UNKNOWN_WORKFLOW_LABEL = "(unknown workflow)" as const;

export interface GitHubWorkflowRun {
  id: number;
  /** GitHub `workflow_run.run_attempt` — stable `id`, incrementing attempt (default 1). */
  run_attempt?: number;
  name: string | null;
  path: string;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
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
  runAttempt: number;
}

export interface MapWorkflowRunContext {
  workspaceId: string;
  repoId: string;
  onUnknownStatus?: (status: string) => void;
}

/**
 * Resolve a display/stored pipeline name from GitHub `workflow_run.name` and `path`.
 * GitHub REST + webhooks allow `name: string | null`; fall back to workflow file stem.
 */
export function resolvePipelineName(
  name: string | null | undefined,
  path: string,
): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }

  const workflowFile = path.match(/\/([^/]+)\.ya?ml$/i)?.[1];
  if (workflowFile) {
    return workflowFile;
  }

  return PIPELINE_UNKNOWN_WORKFLOW_LABEL;
}

/**
 * Resolve a stored branch label from GitHub `workflow_run.head_branch`.
 * GitHub REST + webhooks allow `head_branch: string | null` (e.g. fork PR edge cases).
 */
export function resolveBranch(headBranch: string | null | undefined): string {
  const trimmed = headBranch?.trim();
  return trimmed ? trimmed : PIPELINE_NO_BRANCH_LABEL;
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
  const status = mapGitHubStatus(
    run.status,
    context.onUnknownStatus ? { onUnknown: context.onUnknownStatus } : undefined,
  );
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
    pipelineName: resolvePipelineName(run.name, run.path),
    pipelineDefinitionRef: run.path,
    status,
    conclusion,
    branch: resolveBranch(run.head_branch),
    commitSha: run.head_sha,
    commitMessage: run.head_commit?.message ?? null,
    actorLogin: run.actor?.login ?? null,
    triggerType: run.event,
    sourceUrl: run.html_url,
    startedAt,
    completedAt,
    durationMs: computeDurationMs(startedAt, completedAt),
    runAttempt: run.run_attempt ?? 1,
  };
}

import type { PipelineRun, PipelineRunSummary, SseDataEvent } from "@pipewatch/types";
import type { PipelineStatus } from "@pipewatch/ui";

const ACTIVE_STATUSES = new Set(["queued", "in_progress"]);

export function mapPipelineRunToBadgeStatus(run: PipelineRun): PipelineStatus {
  if (ACTIVE_STATUSES.has(run.status)) {
    return "running";
  }

  if (run.status === "completed") {
    switch (run.conclusion) {
      case "failure":
        return "failure";
      case "cancelled":
        return "cancelled";
      case "skipped":
        return "skipped";
      default:
        return "success";
    }
  }

  return "queued";
}

export function formatTriggerLabel(triggerType: string): string {
  return triggerType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function githubActorAvatarUrl(login: string | null): string | undefined {
  if (!login) {
    return undefined;
  }

  return `https://github.com/${login}.png`;
}

export function isActiveRun(run: PipelineRun): boolean {
  return ACTIVE_STATUSES.has(run.status);
}

function summaryToPipelineRun(
  summary: PipelineRunSummary,
  existing: PipelineRun | undefined,
  repoId: string,
  workspaceId: string,
): PipelineRun {
  const startedAt = summary.startedAt ?? existing?.started_at ?? new Date().toISOString();

  return {
    id: summary.id,
    workspace_id: existing?.workspace_id ?? workspaceId,
    repo_id: existing?.repo_id ?? repoId,
    external_run_id: existing?.external_run_id ?? summary.id,
    pipeline_name: summary.pipelineName,
    pipeline_definition_ref: existing?.pipeline_definition_ref ?? "",
    status: summary.status,
    conclusion: summary.conclusion,
    branch: summary.branch,
    commit_sha: existing?.commit_sha ?? "",
    commit_message: existing?.commit_message ?? null,
    actor_login: existing?.actor_login ?? null,
    trigger_type: existing?.trigger_type ?? "unknown",
    source_url: existing?.source_url ?? "",
    started_at: startedAt,
    completed_at:
      summary.status === "completed" ? startedAt : existing?.completed_at ?? null,
    duration_ms: summary.durationMs ?? existing?.duration_ms ?? null,
    created_at: existing?.created_at ?? startedAt,
  };
}

/** Apply repo SSE events to the run list — new runs prepend (PRD §19, B4). */
export function applySseEventToRuns(
  runs: PipelineRun[],
  event: SseDataEvent,
  context: { repoId: string; workspaceId: string },
): PipelineRun[] {
  if (event.type === "job:updated") {
    return runs;
  }

  const existingIndex = runs.findIndex((run) => run.id === event.data.id);
  const existing = existingIndex >= 0 ? runs[existingIndex] : undefined;
  const nextRun = summaryToPipelineRun(event.data, existing, context.repoId, context.workspaceId);

  if (event.type === "run:created" && existingIndex === -1) {
    return [nextRun, ...runs];
  }

  if (existingIndex === -1) {
    return [nextRun, ...runs];
  }

  const next = [...runs];
  next[existingIndex] = {
    ...existing!,
    ...nextRun,
  };
  return next;
}

export function collectWorkflowNames(runs: PipelineRun[]): string[] {
  const names = new Set<string>();

  for (const run of runs) {
    if (run.pipeline_name) {
      names.add(run.pipeline_name);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export function estimateRunTotalItems(
  page: number,
  pageSize: number,
  rowCount: number,
  hasMore: boolean,
): number {
  if (hasMore) {
    return page * pageSize + 1;
  }

  return (page - 1) * pageSize + rowCount;
}

import type {
  PipelineJob,
  PipelineJobSummary,
  PipelineRun,
  PipelineRunSummary,
  PipelineStep,
  SseDataEvent,
} from "@pipewatch/types";
import type { PipelineStatus } from "@pipewatch/ui";

const ACTIVE_STATUSES = new Set(["queued", "in_progress"]);

export function mapPipelineJobToBadgeStatus(job: PipelineJob | PipelineStep): PipelineStatus {
  if (ACTIVE_STATUSES.has(job.status)) {
    return "running";
  }

  if (job.status === "completed") {
    switch (job.conclusion) {
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

export function isFailedJob(job: PipelineJob): boolean {
  return job.status === "completed" && job.conclusion === "failure";
}

export function isFailedStep(step: PipelineStep): boolean {
  return step.status === "completed" && step.conclusion === "failure";
}

export function isActiveJob(job: PipelineJob): boolean {
  return ACTIVE_STATUSES.has(job.status);
}

export function githubCommitUrl(fullName: string, commitSha: string): string {
  const shortSha = commitSha.slice(0, 7);
  return `https://github.com/${fullName}/commit/${shortSha}`;
}

function summaryToRunPatch(
  summary: PipelineRunSummary,
  existing: PipelineRun,
): PipelineRun {
  return {
    ...existing,
    pipeline_name: summary.pipelineName,
    status: summary.status,
    conclusion: summary.conclusion,
    branch: summary.branch,
    started_at: summary.startedAt ?? existing.started_at,
    duration_ms: summary.durationMs ?? existing.duration_ms,
    completed_at:
      summary.status === "completed"
        ? summary.startedAt ?? existing.completed_at ?? new Date().toISOString()
        : existing.completed_at,
  };
}

function summaryToJobPatch(
  summary: PipelineJobSummary,
  existing: PipelineJob,
): PipelineJob {
  return {
    ...existing,
    name: summary.name,
    status: summary.status,
    conclusion: summary.conclusion,
    duration_ms: summary.durationMs ?? existing.duration_ms,
  };
}

export type RunDetailState = {
  run: PipelineRun;
  jobs: PipelineJob[];
};

/** Apply repo SSE events to run detail state (PRD §19, page B6). */
export function applySseEventToRunDetail(
  state: RunDetailState,
  event: SseDataEvent,
  runId: string,
): RunDetailState {
  if (event.type === "job:updated") {
    const jobIndex = state.jobs.findIndex((job) => job.id === event.data.id);
    if (jobIndex === -1) {
      return state;
    }

    const nextJobs = [...state.jobs];
    nextJobs[jobIndex] = summaryToJobPatch(event.data, state.jobs[jobIndex]!);
    return { ...state, jobs: nextJobs };
  }

  if (event.data.id !== runId) {
    return state;
  }

  return {
    ...state,
    run: summaryToRunPatch(event.data, state.run),
  };
}

export function collectAutoExpandedJobIds(jobs: PipelineJob[]): Set<string> {
  const expanded = new Set<string>();

  for (const job of jobs) {
    if (isFailedJob(job)) {
      expanded.add(job.id);
    }
  }

  return expanded;
}

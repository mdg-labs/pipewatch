import type { PipelineRunSummary, SseDataEvent } from "@pipewatch/types";
import type { PipelineStatus } from "@pipewatch/ui";

import type {
  DashboardHealthSummary,
  DashboardLastRun,
  DashboardRepoCard,
  DashboardSortKey,
  DashboardStatusFilter,
  RepoHealth,
  WorkspaceDashboard,
} from "./dashboard-types";

const ACTIVE_STATUSES = new Set(["queued", "in_progress"]);

export function parseRepoFullName(fullName: string): { org: string; name: string } {
  const slash = fullName.indexOf("/");
  if (slash === -1) {
    return { org: "", name: fullName };
  }

  return {
    org: fullName.slice(0, slash),
    name: fullName.slice(slash + 1),
  };
}

export function githubRepoUrl(fullName: string): string {
  return `https://github.com/${fullName}`;
}

export function classifyRepoHealth(
  isRunning: boolean,
  lastRun: DashboardLastRun | null,
): RepoHealth {
  if (isRunning) {
    return "running";
  }

  if (lastRun?.status === "completed" && lastRun.conclusion === "failure") {
    return "failing";
  }

  return "healthy";
}

export function mapRunToBadgeStatus(
  lastRun: DashboardLastRun | null,
  isRunning: boolean,
): PipelineStatus {
  if (isRunning || lastRun?.status === "in_progress" || lastRun?.status === "queued") {
    return "running";
  }

  if (!lastRun) {
    return "queued";
  }

  if (lastRun.status === "completed") {
    switch (lastRun.conclusion) {
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

export function averageFailureRate(sparkline: number[]): number {
  if (sparkline.length === 0) {
    return 0;
  }

  const sum = sparkline.reduce((total, value) => total + value, 0);
  return Math.round(sum / sparkline.length);
}

export function filterDashboardRepos(
  repos: DashboardRepoCard[],
  statusFilter: DashboardStatusFilter,
  integrationId: string | null,
): DashboardRepoCard[] {
  return repos.filter((repo) => {
    if (statusFilter !== "all" && repo.health !== statusFilter) {
      return false;
    }

    if (integrationId && repo.integration_id !== integrationId) {
      return false;
    }

    return true;
  });
}

export function sortDashboardRepos(
  repos: DashboardRepoCard[],
  sortKey: DashboardSortKey,
): DashboardRepoCard[] {
  const sorted = [...repos];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "name":
        return left.full_name.localeCompare(right.full_name);
      case "failure_rate":
        return averageFailureRate(right.sparkline) - averageFailureRate(left.sparkline);
      case "last_run":
      default: {
        const leftTime = left.last_run?.started_at
          ? new Date(left.last_run.started_at).getTime()
          : 0;
        const rightTime = right.last_run?.started_at
          ? new Date(right.last_run.started_at).getTime()
          : 0;
        return rightTime - leftTime;
      }
    }
  });

  return sorted;
}

function summarizeHealth(repos: DashboardRepoCard[]): DashboardHealthSummary {
  return {
    healthy: repos.filter((repo) => repo.health === "healthy").length,
    running: repos.filter((repo) => repo.health === "running").length,
    failing: repos.filter((repo) => repo.health === "failing").length,
    total: repos.length,
  };
}

function patchLastRunFromSse(
  existing: DashboardLastRun | null,
  run: PipelineRunSummary,
): DashboardLastRun {
  const startedAt = run.startedAt ?? existing?.started_at ?? new Date().toISOString();

  return {
    id: run.id,
    external_run_id: existing?.external_run_id ?? run.id,
    pipeline_name: run.pipelineName,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.branch,
    commit_sha: existing?.commit_sha ?? "",
    commit_message: existing?.commit_message ?? null,
    actor_login: existing?.actor_login ?? null,
    trigger_type: existing?.trigger_type ?? "unknown",
    source_url: existing?.source_url ?? "",
    started_at: startedAt,
    completed_at:
      run.status === "completed" ? startedAt : existing?.completed_at ?? null,
    duration_ms: run.durationMs ?? existing?.duration_ms ?? null,
  };
}

function patchRepoFromSseEvent(
  repo: DashboardRepoCard,
  event: SseDataEvent,
): DashboardRepoCard {
  if (event.type === "job:updated") {
    return repo;
  }

  const lastRun = patchLastRunFromSse(repo.last_run, event.data);
  const isRunning = ACTIVE_STATUSES.has(event.data.status);
  const health = classifyRepoHealth(isRunning, lastRun);

  return {
    ...repo,
    is_running: isRunning,
    health,
    last_run: lastRun,
  };
}

/** Apply a repo-scoped SSE event to dashboard aggregates (PRD §19, B3). */
export function applySseEventToDashboard(
  dashboard: WorkspaceDashboard,
  repoId: string,
  event: SseDataEvent,
): WorkspaceDashboard {
  const repos = dashboard.repos.map((repo) =>
    repo.id === repoId ? patchRepoFromSseEvent(repo, event) : repo,
  );

  return {
    health: summarizeHealth(repos),
    repos,
  };
}


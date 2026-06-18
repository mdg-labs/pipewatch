import type {
  InsightsRange,
  InsightsTimeSeriesDay,
  WorkspaceInsights,
} from "@pipewatch/types";
import type { TimeSeriesSeries } from "@pipewatch/ui";

import { runFiltersQueryString, type RunListFilters } from "@/lib/run-filters";

const MAX_CHART_SERIES = 5;

export type WorkflowSeriesKey = {
  workflow: string;
  repoId: string;
  repoFullName: string;
};

function workflowSeriesKey(point: {
  workflow: string;
  repo_id: string;
  repo_full_name: string;
}): string {
  return `${point.repo_id}:${point.workflow}`;
}

function parseWorkflowSeriesKey(key: string): WorkflowSeriesKey | null {
  const separator = key.indexOf(":");
  if (separator === -1) {
    return null;
  }

  return {
    repoId: key.slice(0, separator),
    workflow: key.slice(separator + 1),
    repoFullName: "",
  };
}

/** Rank workflows by total activity across the selected period. */
export function rankWorkflowKeys(days: InsightsTimeSeriesDay[]): string[] {
  const totals = new Map<string, number>();

  for (const day of days) {
    for (const point of day.points) {
      const key = workflowSeriesKey(point);
      totals.set(key, (totals.get(key) ?? 0) + point.value);
    }
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key]) => key)
    .slice(0, MAX_CHART_SERIES);
}

export function buildTimeSeriesChartData(
  days: InsightsTimeSeriesDay[],
  keys: string[],
): { labels: string[]; series: TimeSeriesSeries[]; pointsByDay: InsightsTimeSeriesDay["points"][] } {
  const labels = days.map((day) => formatChartDateLabel(day.date));
  const meta = new Map<string, WorkflowSeriesKey>();

  for (const day of days) {
    for (const point of day.points) {
      const key = workflowSeriesKey(point);
      if (!meta.has(key)) {
        meta.set(key, {
          workflow: point.workflow,
          repoId: point.repo_id,
          repoFullName: point.repo_full_name,
        });
      }
    }
  }

  const series: TimeSeriesSeries[] = keys.map((key) => {
    const info = meta.get(key) ?? parseWorkflowSeriesKey(key);
    const label = info
      ? info.repoFullName
        ? `${info.workflow} (${info.repoFullName})`
        : info.workflow
      : key;

    return {
      id: key,
      label,
      data: days.map((day) => {
        const match = day.points.find((point) => workflowSeriesKey(point) === key);
        return match?.value ?? 0;
      }),
    };
  });

  return {
    labels,
    series,
    pointsByDay: days.map((day) => day.points),
  };
}

export function formatChartDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatInsightsCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatMsAsDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) {
    return "—";
  }

  const totalSeconds = Math.round(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

export function formatDurationAxisLabel(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes >= 10) {
    return `${Math.round(minutes)}m`;
  }

  if (minutes >= 1) {
    return `${minutes.toFixed(minutes >= 5 ? 0 : 1)}m`;
  }

  return `${Math.round(ms / 1_000)}s`;
}

export function buildDurationAxisLabels(minMs: number, maxMs: number): string[] {
  const steps = [1, 0.75, 0.5, 0.25, 0];
  const range = maxMs - minMs || 1;

  return steps.map((step) => formatDurationAxisLabel(minMs + range * step));
}

export function buildPercentAxisLabels(maxPercent: number): string[] {
  const max = Math.max(maxPercent, 1);
  const steps = [1, 0.75, 0.5, 0.25, 0];

  return steps.map((step) => `${Math.round(max * step)}%`);
}

export type TrendTone = "up" | "down" | "neutral";

export function resolveTrendTone(
  value: number | null | undefined,
  positiveIsGood: boolean,
): TrendTone {
  if (value == null || value === 0) {
    return "neutral";
  }

  const positive = value > 0;
  if (positiveIsGood) {
    return positive ? "up" : "down";
  }

  return positive ? "down" : "up";
}

export function formatSignedPercent(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const absolute = Math.abs(value);
  const formatted = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}%`;
}

export function formatSignedPoints(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const absolute = Math.abs(value);
  const formatted = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted} pts`;
}

export function hasInsightsData(insights: WorkspaceInsights | null): boolean {
  return Boolean(insights && insights.summary.total_runs > 0);
}

export function collectWorkflowOptions(insights: WorkspaceInsights): string[] {
  const names = new Set<string>();

  for (const row of insights.slowest_workflows) {
    names.add(row.workflow);
  }

  for (const row of insights.most_failing_workflows) {
    names.add(row.workflow);
  }

  for (const day of insights.time_series.duration) {
    for (const point of day.points) {
      names.add(point.workflow);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export function parseRepoShortName(fullName: string): string {
  const slash = fullName.indexOf("/");
  return slash === -1 ? fullName : fullName.slice(slash + 1);
}

export function buildWorkflowRunsHref(
  workspaceSlug: string,
  repoId: string,
  workflow: string,
  range: InsightsRange,
): string {
  const filters: RunListFilters = {
    branch: undefined,
    workflow,
    status: "all",
    trigger: undefined,
    range,
    page: 1,
    cursor: undefined,
  };

  return `/workspaces/${workspaceSlug}/repos/${repoId}${runFiltersQueryString(filters)}`;
}

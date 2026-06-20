import type {
  InsightsRange,
  InsightsTimeSeriesDay,
  WorkspaceInsights,
} from "@pipewatch/types";
import type { TimeSeriesSeries } from "@pipewatch/ui";

import { formatChartDateLabel } from "@/i18n/insights-formatters";
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
  formatChartDate: (isoDate: string) => string = formatChartDateLabel,
): { labels: string[]; series: TimeSeriesSeries[]; pointsByDay: InsightsTimeSeriesDay["points"][] } {
  const labels = days.map((day) => formatChartDate(day.date));
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

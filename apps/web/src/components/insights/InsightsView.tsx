"use client";

import type { InsightsRange, RepositorySummary, WorkspaceInsights } from "@pipewatch/types";
import { EmptyState, FilterBar, Select, StatCard, classNames } from "@pipewatch/ui";
import { GitBranch } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import {
  buildInsightsPath,
  insightsApiQueryString,
  parseInsightsFilters,
  withUpdatedInsightsFilters,
  type InsightsFilters,
} from "@/lib/insights-filters";
import {
  formatInsightsCount,
  formatMsAsDuration,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
  hasInsightsData,
  parseRepoShortName,
  resolveTrendTone,
} from "@/lib/insights-utils";

import { InsightsCharts } from "./InsightsCharts";
import { InsightsTables } from "./InsightsTables";

import "./insights.css";

export type InsightsViewProps = {
  workspaceSlug: string;
};

type TrendFormat = "percent" | "points";

function TrendLine({
  value,
  suffix,
  positiveIsGood,
  format = "percent",
}: {
  value: number | null | undefined;
  suffix: string;
  positiveIsGood: boolean;
  format?: TrendFormat;
}) {
  const tone = resolveTrendTone(value, positiveIsGood);
  const formatted =
    format === "points" ? formatSignedPoints(value) : formatSignedPercent(value);

  if (!formatted) {
    return <span className="pw-insights-trend pw-insights-trend-neutral">No prior period data</span>;
  }

  const arrow = tone === "up" ? "↑" : tone === "down" ? "↓" : "→";
  const className =
    tone === "up"
      ? "pw-insights-trend pw-insights-trend-up"
      : tone === "down"
        ? "pw-insights-trend pw-insights-trend-down"
        : "pw-insights-trend pw-insights-trend-neutral";

  return (
    <span className={className}>
      <span aria-hidden>{arrow}</span>
      <span>
        {formatted} {suffix}
      </span>
    </span>
  );
}

function DurationTrend({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <span className="pw-insights-trend pw-insights-trend-neutral">No prior period data</span>;
  }

  if (percent === 0) {
    return <span className="pw-insights-trend pw-insights-trend-neutral">→ No change vs prev. period</span>;
  }

  const improved = percent < 0;
  const formatted = formatSignedPercent(Math.abs(percent));

  return (
    <span
      className={classNames(
        "pw-insights-trend",
        improved ? "pw-insights-trend-up" : "pw-insights-trend-down",
      )}
    >
      <span aria-hidden>{improved ? "↓" : "↑"}</span>
      <span>
        {formatted} {improved ? "faster" : "slower"} vs prev. period
      </span>
    </span>
  );
}

function InsightsRangeToggle({
  range,
  onChange,
}: {
  range: InsightsRange;
  onChange: (range: InsightsRange) => void;
}) {
  return (
    <div className="pw-insights-range-toggle" role="group" aria-label="Time range">
      {(["7d", "30d"] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={classNames(
            "pw-insights-range-btn",
            range === option && "pw-insights-range-btn-active",
          )}
          aria-pressed={range === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function InsightsView({ workspaceSlug }: InsightsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace } = useApi();

  const filters = useMemo(
    () => parseInsightsFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [insights, setInsights] = useState<WorkspaceInsights | null>(null);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const updateFilters = useCallback(
    (patch: Partial<InsightsFilters>) => {
      const next = withUpdatedInsightsFilters(filters, patch);
      router.replace(buildInsightsPath(workspaceSlug, next));
    },
    [filters, router, workspaceSlug],
  );

  const loadInsights = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const [insightsData, repoData] = await Promise.all([
        workspace.get<WorkspaceInsights>(`/insights?${insightsApiQueryString(filters)}`),
        workspace.get<RepositorySummary[]>("/repositories"),
      ]);

      setInsights(insightsData);
      setRepositories(repoData);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspace, filters]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const workflowOptions = useMemo(() => {
    if (!insights) {
      return [];
    }

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
  }, [insights]);

  const enabledRepositories = useMemo(
    () => repositories.filter((repo) => repo.enabled),
    [repositories],
  );

  if (loading) {
    return (
      <div className="pw-insights" aria-busy="true" aria-label="Loading insights">
        <div className="pw-insights-header">
          <h1 className="pw-insights-title">Insights</h1>
        </div>
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pw-insights">
        <div className="pw-insights-header">
          <h1 className="pw-insights-title">Insights</h1>
        </div>
        <ErrorRetry message="We could not load workspace insights." onRetry={() => void loadInsights()} />
      </div>
    );
  }

  if (!insights || !hasInsightsData(insights)) {
    return (
      <div className="pw-insights">
        <div className="pw-insights-header">
          <h1 className="pw-insights-title">Insights</h1>
          <InsightsRangeToggle range={filters.range} onChange={(range) => updateFilters({ range })} />
        </div>

        <FilterBar className="pw-insights-filters">
          <Select
            label="Repository"
            size="sm"
            value={filters.repoId ?? "all"}
            options={[
              { value: "all", label: "All repos" },
              ...enabledRepositories.map((repo) => ({
                value: repo.id,
                label: repo.full_name,
              })),
            ]}
            onChange={(value) => updateFilters({ repoId: value === "all" ? undefined : value })}
            className="pw-insights-filter"
            mono
          />
          <Select
            label="Workflow"
            size="sm"
            value={filters.workflow ?? "all"}
            options={[
              { value: "all", label: "All workflows" },
              ...workflowOptions.map((workflow) => ({
                value: workflow,
                label: workflow,
              })),
            ]}
            onChange={(value) => updateFilters({ workflow: value === "all" ? undefined : value })}
            className="pw-insights-filter"
          />
        </FilterBar>

        <EmptyState
          icon={<GitBranch size={20} aria-hidden />}
          title="Not enough data yet — insights appear once runs are recorded."
        />
      </div>
    );
  }

  const { summary } = insights;

  return (
    <div className="pw-insights">
      <div className="pw-insights-header">
        <h1 className="pw-insights-title">Insights</h1>
        <InsightsRangeToggle range={filters.range} onChange={(range) => updateFilters({ range })} />
      </div>

      <FilterBar className="pw-insights-filters">
        <Select
          label="Repository"
          size="sm"
          value={filters.repoId ?? "all"}
          options={[
            { value: "all", label: "All repos" },
            ...enabledRepositories.map((repo) => ({
              value: repo.id,
              label: repo.full_name,
            })),
          ]}
          onChange={(value) => updateFilters({ repoId: value === "all" ? undefined : value })}
          className="pw-insights-filter"
          mono
        />
        <Select
          label="Workflow"
          size="sm"
          value={filters.workflow ?? "all"}
          options={[
            { value: "all", label: "All workflows" },
            ...workflowOptions.map((workflow) => ({
              value: workflow,
              label: workflow,
            })),
          ]}
          onChange={(value) => updateFilters({ workflow: value === "all" ? undefined : value })}
          className="pw-insights-filter"
        />
      </FilterBar>

      <div className="pw-insights-summary-grid">
        <StatCard
          label="Total runs"
          value={formatInsightsCount(summary.total_runs)}
          trend={
            <TrendLine
              value={summary.trends.total_runs_percent}
              suffix="vs prev. period"
              positiveIsGood
            />
          }
        />
        <StatCard
          label="Success rate"
          value={formatPercent(summary.success_rate)}
          trend={
            <TrendLine
              value={summary.trends.success_rate_points}
              suffix="vs prev. period"
              positiveIsGood
              format="points"
            />
          }
        />
        <StatCard
          label="Avg duration"
          value={formatMsAsDuration(summary.avg_duration_ms)}
          mono
          trend={<DurationTrend percent={summary.trends.avg_duration_percent} />}
        />
        <StatCard
          label="Most active repo"
          value={
            summary.most_active_repo
              ? parseRepoShortName(summary.most_active_repo.full_name)
              : "—"
          }
          mono
          trend={
            summary.most_active_repo ? (
              <p className="pw-insights-summary-meta">
                {formatInsightsCount(summary.most_active_repo.run_count)} runs this period
              </p>
            ) : undefined
          }
        />
      </div>

      <InsightsCharts
        durationDays={insights.time_series.duration}
        failureDays={insights.time_series.failure_rate}
        range={insights.range}
      />

      <InsightsTables
        slowestWorkflows={insights.slowest_workflows}
        mostFailingWorkflows={insights.most_failing_workflows}
        workspaceSlug={workspaceSlug}
        range={insights.range}
      />
    </div>
  );
}

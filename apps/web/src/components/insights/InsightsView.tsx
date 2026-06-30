"use client";

import type { InsightsRange, RepositorySummary, WorkspaceInsights } from "@pipewatch/types";
import { EmptyState, FilterBar, Select, StatCard, classNames } from "@pipewatch/ui";
import { GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import { useInsightsFormatters } from "@/i18n/use-insights-formatters";
import {
  formatSignedPercent,
  formatSignedPoints,
} from "@/i18n/insights-formatters";
import {
  buildInsightsPath,
  insightsApiQueryString,
  parseInsightsFilters,
  withUpdatedInsightsFilters,
  type InsightsFilters,
} from "@/lib/insights-filters";
import {
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
  noPriorPeriodLabel,
}: {
  value: number | null | undefined;
  suffix: string;
  positiveIsGood: boolean;
  format?: TrendFormat;
  noPriorPeriodLabel: string;
}) {
  const tone = resolveTrendTone(value, positiveIsGood);
  const formatted =
    format === "points" ? formatSignedPoints(value) : formatSignedPercent(value);

  if (!formatted) {
    return <span className="pw-insights-trend pw-insights-trend-neutral">{noPriorPeriodLabel}</span>;
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

function DurationTrend({
  percent,
  noPriorPeriodLabel,
  noChangeLabel,
  fasterLabel,
  slowerLabel,
}: {
  percent: number | null;
  noPriorPeriodLabel: string;
  noChangeLabel: string;
  fasterLabel: (percent: string) => string;
  slowerLabel: (percent: string) => string;
}) {
  if (percent == null) {
    return <span className="pw-insights-trend pw-insights-trend-neutral">{noPriorPeriodLabel}</span>;
  }

  if (percent === 0) {
    return <span className="pw-insights-trend pw-insights-trend-neutral">{noChangeLabel}</span>;
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
      <span>{improved ? fasterLabel(formatted ?? "") : slowerLabel(formatted ?? "")}</span>
    </span>
  );
}

function InsightsRangeToggle({
  range,
  onChange,
  ariaLabel,
  labels,
}: {
  range: InsightsRange;
  onChange: (range: InsightsRange) => void;
  ariaLabel: string;
  labels: Record<InsightsRange, string>;
}) {
  return (
    <div className="pw-insights-range-toggle" role="group" aria-label={ariaLabel}>
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
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

export function InsightsView({ workspaceSlug }: InsightsViewProps) {
  const t = useTranslations("insights");
  const { formatCount, formatMsAsDuration, formatPercent, emDash } = useInsightsFormatters();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace, workspaceId, workspaceStatus } = useApi();

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
      if (workspaceStatus === "unresolved") {
        setLoading(false);
        setLoadError(true);
      }
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
  }, [workspaceId, workspaceStatus, filters]);

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

  const rangeLabels = useMemo(
    () => ({
      "7d": t("range.7d"),
      "30d": t("range.30d"),
    }),
    [t],
  );

  const filterBar = (
    <FilterBar className="pw-insights-filters">
      <Select
        label={t("filters.repository")}
        size="sm"
        value={filters.repoId ?? "all"}
        options={[
          { value: "all", label: t("filters.allRepos") },
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
        label={t("filters.workflow")}
        size="sm"
        value={filters.workflow ?? "all"}
        options={[
          { value: "all", label: t("filters.allWorkflows") },
          ...workflowOptions.map((workflow) => ({
            value: workflow,
            label: workflow,
          })),
        ]}
        onChange={(value) => updateFilters({ workflow: value === "all" ? undefined : value })}
        className="pw-insights-filter"
      />
    </FilterBar>
  );

  if (loading) {
    return (
      <div className="pw-insights" aria-busy="true" aria-label={t("loadingAriaLabel")}>
        <div className="pw-insights-header">
          <h1 className="pw-insights-title">{t("title")}</h1>
        </div>
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pw-insights">
        <div className="pw-insights-header">
          <h1 className="pw-insights-title">{t("title")}</h1>
        </div>
        <ErrorRetry message={t("loadError")} onRetry={() => void loadInsights()} />
      </div>
    );
  }

  if (!insights || !hasInsightsData(insights)) {
    return (
      <div className="pw-insights">
        <div className="pw-insights-header">
          <h1 className="pw-insights-title">{t("title")}</h1>
          <InsightsRangeToggle
            range={filters.range}
            onChange={(range) => updateFilters({ range })}
            ariaLabel={t("filters.timeRangeAriaLabel")}
            labels={rangeLabels}
          />
        </div>

        {filterBar}

        <EmptyState
          icon={<GitBranch size={20} aria-hidden />}
          title={t("empty.title")}
        />
      </div>
    );
  }

  const { summary } = insights;

  return (
    <div className="pw-insights">
      <div className="pw-insights-header">
        <h1 className="pw-insights-title">{t("title")}</h1>
        <InsightsRangeToggle
          range={filters.range}
          onChange={(range) => updateFilters({ range })}
          ariaLabel={t("filters.timeRangeAriaLabel")}
          labels={rangeLabels}
        />
      </div>

      {filterBar}

      <div className="pw-insights-summary-grid">
        <StatCard
          label={t("summary.totalRuns")}
          value={formatCount(summary.total_runs)}
          trend={
            <TrendLine
              value={summary.trends.total_runs_percent}
              suffix={t("trends.vsPrevPeriod")}
              positiveIsGood
              noPriorPeriodLabel={t("trends.noPriorPeriod")}
            />
          }
        />
        <StatCard
          label={t("summary.successRate")}
          value={formatPercent(summary.success_rate)}
          trend={
            <TrendLine
              value={summary.trends.success_rate_points}
              suffix={t("trends.vsPrevPeriod")}
              positiveIsGood
              format="points"
              noPriorPeriodLabel={t("trends.noPriorPeriod")}
            />
          }
        />
        <StatCard
          label={t("summary.avgDuration")}
          value={formatMsAsDuration(summary.avg_duration_ms)}
          mono
          trend={
            <DurationTrend
              percent={summary.trends.avg_duration_percent}
              noPriorPeriodLabel={t("trends.noPriorPeriod")}
              noChangeLabel={t("trends.noChange")}
              fasterLabel={(percent) => t("trends.fasterVsPrev", { percent })}
              slowerLabel={(percent) => t("trends.slowerVsPrev", { percent })}
            />
          }
        />
        <StatCard
          label={t("summary.mostActiveRepo")}
          value={
            summary.most_active_repo
              ? parseRepoShortName(summary.most_active_repo.full_name)
              : emDash
          }
          mono
          trend={
            summary.most_active_repo ? (
              <p className="pw-insights-summary-meta">
                {t("summary.runsThisPeriod", {
                  formattedCount: formatCount(summary.most_active_repo.run_count),
                })}
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

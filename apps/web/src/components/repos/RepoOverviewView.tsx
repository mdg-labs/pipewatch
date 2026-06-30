"use client";

import type {
  InsightsRange,
  PipelineRun,
  RepositorySummary,
  SseDataEvent,
  WorkspaceInsights,
} from "@pipewatch/types";
import { Button, EmptyState, StatCard, classNames } from "@pipewatch/ui";
import { GitBranch } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { InsightsTables } from "@/components/insights/InsightsTables";
import { ActiveRunBanner } from "@/components/repos/ActiveRunBanner";
import { RepoHeader } from "@/components/repos/RepoHeader";
import { RepoRecentRuns } from "@/components/repos/RepoRecentRuns";
import { useSetLiveStreamOverride, useLiveStreamOverrideClaim } from "@/contexts/live-stream-override-context";
import { useApi } from "@/hooks/use-api";
import { useRepoStream } from "@/hooks/use-repo-stream";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import {
  formatSignedPercent,
  formatSignedPoints,
} from "@/i18n/insights-formatters";
import { useInsightsFormatters } from "@/i18n/use-insights-formatters";
import { ApiClientError } from "@/lib/api-client";
import { hasInsightsData, resolveTrendTone } from "@/lib/insights-utils";
import {
  RECENT_RUNS_PAGE_SIZE,
  buildRepoOverviewPath,
  buildViewAllRunsHref,
  parseRepoOverviewFilters,
  repoOverviewInsightsApiQueryString,
  type RepoOverviewFilters,
} from "@/lib/repo-overview-filters";
import { type RunsListResponse } from "@/lib/run-filters";
import { applySseEventToRuns } from "@/lib/run-utils";
import { useToast } from "@/providers/ToastProvider";

import "@/components/insights/insights.css";
import "./repo-detail.css";

export type RepoOverviewViewProps = {
  workspaceSlug: string;
  repoId: string;
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

function OverviewRangeToggle({
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

export function RepoOverviewView({ workspaceSlug, repoId }: RepoOverviewViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace, workspaceId, workspaceStatus } = useApi();
  const { canMutate } = useWorkspaceRole();
  const { toast } = useToast();
  const setLiveStreamOverride = useSetLiveStreamOverride();
  const { claimOverride, releaseOverride } = useLiveStreamOverrideClaim();
  const t = useTranslations("repos");
  const tInsights = useTranslations("insights");
  const { formatCount, formatMsAsDuration, formatPercent } = useInsightsFormatters();

  const filters = useMemo(
    () => parseRepoOverviewFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [repository, setRepository] = useState<RepositorySummary | null>(null);
  const [insights, setInsights] = useState<WorkspaceInsights | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const viewAllRunsHref = useMemo(
    () => buildViewAllRunsHref(workspaceSlug, repoId),
    [repoId, workspaceSlug],
  );

  const updateFilters = useCallback(
    (patch: Partial<RepoOverviewFilters>) => {
      const next = { ...filters, ...patch };
      router.replace(buildRepoOverviewPath(workspaceSlug, repoId, next));
    },
    [filters, repoId, router, workspaceSlug],
  );

  const loadData = useCallback(async () => {
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
      const [repoData, insightsData, runsResponse] = await Promise.all([
        workspace.get<RepositorySummary>(`/repositories/${repoId}`),
        workspace.get<WorkspaceInsights>(
          `/insights?${repoOverviewInsightsApiQueryString(repoId, filters)}`,
        ),
        workspace.get<RunsListResponse>(
          `/repositories/${repoId}/runs?page_size=${RECENT_RUNS_PAGE_SIZE}`,
        ),
      ]);

      setRepository(repoData);
      setInsights(insightsData);
      setRuns(runsResponse.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspaceStatus, repoId, filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSseEvent = useCallback(
    (event: SseDataEvent) => {
      if (!workspaceId) {
        return;
      }

      setRuns((current) => {
        const next = applySseEventToRuns(current, event, { repoId, workspaceId });
        return next.slice(0, RECENT_RUNS_PAGE_SIZE + 10);
      });
    },
    [repoId, workspaceId],
  );

  const { status: liveStatus } = useRepoStream({
    repoId,
    onEvent: handleSseEvent,
  });

  useLayoutEffect(() => {
    claimOverride();
    return () => {
      releaseOverride();
    };
  }, [claimOverride, releaseOverride]);

  useEffect(() => {
    setLiveStreamOverride(liveStatus);
    return () => {
      setLiveStreamOverride(null);
    };
  }, [liveStatus, setLiveStreamOverride]);

  const rangeLabels = useMemo(
    () => ({
      "7d": tInsights("range.7d"),
      "30d": tInsights("range.30d"),
    }),
    [tInsights],
  );

  const recentRuns = useMemo(() => runs.slice(0, RECENT_RUNS_PAGE_SIZE), [runs]);

  const handleResync = useCallback(async () => {
    if (!workspace || !canMutate) {
      return;
    }

    setSyncing(true);

    try {
      await workspace.post(`/repositories/${repoId}/sync`);
      toast({
        title: t("resync.startedTitle"),
        description: t("resync.startedDescription"),
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : t("resync.failedDescription");
      toast({
        title: t("resync.failedTitle"),
        description: message,
        variant: "error",
      });
    } finally {
      setSyncing(false);
    }
  }, [canMutate, repoId, t, toast, workspaceId]);

  if (loading) {
    return (
      <div className="pw-repo-detail pw-repo-overview" aria-busy="true">
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (loadError || !repository) {
    return (
      <div className="pw-repo-detail pw-repo-overview">
        <ErrorRetry message={t("loadError")} onRetry={() => void loadData()} />
      </div>
    );
  }

  if (!insights || !hasInsightsData(insights)) {
    return (
      <div className="pw-repo-detail pw-repo-overview">
        <RepoHeader
          repository={repository}
          workspaceSlug={workspaceSlug}
          syncing={syncing}
          onResync={() => void handleResync()}
          canResync={canMutate}
        />

        <ActiveRunBanner runs={runs} workspaceSlug={workspaceSlug} repoId={repoId} />

        <OverviewRangeToggle
          range={filters.range}
          onChange={(range) => updateFilters({ range })}
          ariaLabel={tInsights("filters.timeRangeAriaLabel")}
          labels={rangeLabels}
        />

        <EmptyState
          icon={<GitBranch size={20} aria-hidden />}
          title={t("empty.title")}
          description={t("empty.description")}
          actions={
            canMutate ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={syncing}
                onClick={() => void handleResync()}
              >
                {syncing ? t("header.resyncing") : t("header.resync")}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const { summary } = insights;

  return (
    <div className="pw-repo-detail pw-repo-overview">
      <RepoHeader
        repository={repository}
        workspaceSlug={workspaceSlug}
        syncing={syncing}
        onResync={() => void handleResync()}
        canResync={canMutate}
      />

      <ActiveRunBanner runs={runs} workspaceSlug={workspaceSlug} repoId={repoId} />

      <div className="pw-repo-overview-toolbar">
        <OverviewRangeToggle
          range={filters.range}
          onChange={(range) => updateFilters({ range })}
          ariaLabel={tInsights("filters.timeRangeAriaLabel")}
          labels={rangeLabels}
        />
      </div>

      <div className="pw-insights-summary-grid pw-repo-overview-summary">
        <StatCard
          label={tInsights("summary.totalRuns")}
          value={formatCount(summary.total_runs)}
          trend={
            <TrendLine
              value={summary.trends.total_runs_percent}
              suffix={tInsights("trends.vsPrevPeriod")}
              positiveIsGood
              noPriorPeriodLabel={tInsights("trends.noPriorPeriod")}
            />
          }
        />
        <StatCard
          label={tInsights("summary.successRate")}
          value={formatPercent(summary.success_rate)}
          trend={
            <TrendLine
              value={summary.trends.success_rate_points}
              suffix={tInsights("trends.vsPrevPeriod")}
              positiveIsGood
              format="points"
              noPriorPeriodLabel={tInsights("trends.noPriorPeriod")}
            />
          }
        />
        <StatCard
          label={tInsights("summary.avgDuration")}
          value={formatMsAsDuration(summary.avg_duration_ms)}
          mono
          trend={
            <DurationTrend
              percent={summary.trends.avg_duration_percent}
              noPriorPeriodLabel={tInsights("trends.noPriorPeriod")}
              noChangeLabel={tInsights("trends.noChange")}
              fasterLabel={(percent) => tInsights("trends.fasterVsPrev", { percent })}
              slowerLabel={(percent) => tInsights("trends.slowerVsPrev", { percent })}
            />
          }
        />
      </div>

      <InsightsTables
        slowestWorkflows={[]}
        mostFailingWorkflows={insights.most_failing_workflows}
        workspaceSlug={workspaceSlug}
        range={insights.range}
        showSlowest={false}
      />

      <RepoRecentRuns
        runs={recentRuns}
        workspaceSlug={workspaceSlug}
        repoId={repoId}
        viewAllHref={viewAllRunsHref}
      />
    </div>
  );
}

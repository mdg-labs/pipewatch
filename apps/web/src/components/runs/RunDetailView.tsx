"use client";

import type {
  PipelineJob,
  PipelineRun,
  PipelineStep,
  RepositorySummary,
  SseDataEvent,
} from "@pipewatch/types";
import { Avatar, StatusBadge } from "@pipewatch/ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useSetLiveStreamOverride, useLiveStreamOverrideClaim } from "@/contexts/live-stream-override-context";
import { useApi } from "@/hooks/use-api";
import { useRepoStream } from "@/hooks/use-repo-stream";
import { formatTriggerLabel } from "@/i18n/trigger-labels";
import { useTimeFormatters } from "@/i18n/use-time-formatters";
import {
  applySseEventToRunDetail,
  buildRunDetailBreadcrumbHrefs,
  collectAutoExpandedJobIds,
  githubCommitUrl,
} from "@/lib/run-detail-utils";
import {
  formatBranchDisplay,
  formatPipelineNameDisplay,
  githubActorAvatarUrl,
  isActiveRun,
  mapPipelineRunToBadgeStatus,
} from "@/lib/run-utils";

import { ElapsedTicker } from "./ElapsedTicker";
import { JobGraph } from "./JobGraph";
import { JobPanel } from "./JobPanel";

import "./run-detail.css";

export type RunDetailViewProps = {
  workspaceSlug: string;
  repoId: string;
  runId: string;
};

type JobStepsMap = Record<string, PipelineStep[]>;

async function loadJobSteps(
  workspace: NonNullable<ReturnType<typeof useApi>["workspace"]>,
  repoId: string,
  runId: string,
  jobs: PipelineJob[],
): Promise<JobStepsMap> {
  const entries = await Promise.all(
    jobs.map(async (job) => {
      const response = await workspace.get<{ data: PipelineStep[] }>(
        `/repositories/${repoId}/runs/${runId}/jobs/${job.id}/steps`,
      );
      return [job.id, response.data] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export function RunDetailView({ workspaceSlug, repoId, runId }: RunDetailViewProps) {
  const t = useTranslations("runs");
  const tTriggers = useTranslations("runs.triggers");
  const tBreadcrumb = useTranslations("runs.breadcrumb");
  const tAppBreadcrumbs = useTranslations("app.breadcrumbs");
  const { formatDuration, formatRelativeTime, emDash } = useTimeFormatters();
  const { workspace, workspaceId } = useApi();
  const setLiveStreamOverride = useSetLiveStreamOverride();
  const { claimOverride, releaseOverride } = useLiveStreamOverrideClaim();

  const [repository, setRepository] = useState<RepositorySummary | null>(null);
  const [runDetail, setRunDetail] = useState<{ run: PipelineRun; jobs: PipelineJob[] } | null>(
    null,
  );
  const [stepsByJobId, setStepsByJobId] = useState<JobStepsMap>({});
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(() => new Set());
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const [repoData, runData, jobsResponse] = await Promise.all([
        workspace.get<RepositorySummary>(`/repositories/${repoId}`),
        workspace.get<PipelineRun>(`/repositories/${repoId}/runs/${runId}`),
        workspace.get<{ data: PipelineJob[] }>(`/repositories/${repoId}/runs/${runId}/jobs`),
      ]);

      const nextSteps = await loadJobSteps(workspace, repoId, runId, jobsResponse.data);

      setRepository(repoData);
      setRunDetail({ run: runData, jobs: jobsResponse.data });
      setStepsByJobId(nextSteps);
      setExpandedJobIds(collectAutoExpandedJobIds(jobsResponse.data));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repoId, runId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSseEvent = useCallback(
    (event: SseDataEvent) => {
      setRunDetail((current) => {
        if (!current) {
          return current;
        }

        const next = applySseEventToRunDetail(current, event, runId);

        setExpandedJobIds((expanded) => {
          const merged = new Set(expanded);
          for (const jobId of collectAutoExpandedJobIds(next.jobs)) {
            merged.add(jobId);
          }
          return merged;
        });

        return next;
      });
    },
    [runId],
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

  const handleJobSelect = useCallback((jobId: string) => {
    setHighlightedJobId(jobId);
    setExpandedJobIds((current) => {
      const next = new Set(current);
      next.add(jobId);
      return next;
    });
  }, []);

  const toggleJobPanel = useCallback((jobId: string) => {
    setExpandedJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const run = runDetail?.run ?? null;
  const jobs = runDetail?.jobs ?? [];

  const headerDuration = useMemo(() => {
    if (!run) {
      return emDash;
    }

    if (isActiveRun(run)) {
      return <ElapsedTicker startedAt={run.started_at} className="pw-run-detail-duration-live" />;
    }

    return formatDuration(
      run.duration_ms !== null ? Math.round(run.duration_ms / 1_000) : null,
    );
  }, [emDash, formatDuration, run]);

  if (loading) {
    return (
      <div className="pw-run-detail" aria-busy="true">
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (loadError || !run || !repository) {
    return (
      <div className="pw-run-detail">
        <ErrorRetry message={t("loadError")} onRetry={() => void loadData()} />
      </div>
    );
  }

  const commitHref = run.commit_sha
    ? githubCommitUrl(repository.full_name, run.commit_sha)
    : undefined;
  const shortSha = run.commit_sha ? run.commit_sha.slice(0, 7) : emDash;
  const avatarUrl = githubActorAvatarUrl(run.actor_login);
  const breadcrumbHrefs = buildRunDetailBreadcrumbHrefs(workspaceSlug, repoId);

  return (
    <div className="pw-run-detail">
      <nav className="pw-run-detail-breadcrumb" aria-label={tBreadcrumb("ariaLabel")}>
        <Link href={breadcrumbHrefs.dashboard} className="pw-run-detail-breadcrumb-link">
          {tAppBreadcrumbs("repos")}
        </Link>
        <span aria-hidden>/</span>
        <Link href={breadcrumbHrefs.repoOverview} className="pw-run-detail-breadcrumb-link">
          {repository.full_name}
        </Link>
        <span aria-hidden>/</span>
        <Link href={breadcrumbHrefs.allRuns} className="pw-run-detail-breadcrumb-link">
          {tBreadcrumb("allRuns")}
        </Link>
        <span aria-hidden>/</span>
        <span className="pw-run-detail-breadcrumb-current">
          {formatPipelineNameDisplay(run.pipeline_name, emDash)}
        </span>
      </nav>

      <header className="pw-run-detail-header">
        <div className="pw-run-detail-header-top">
          <div className="pw-run-detail-title-row">
            <h1 className="pw-run-detail-title">{formatPipelineNameDisplay(run.pipeline_name, emDash)}</h1>
            <StatusBadge status={mapPipelineRunToBadgeStatus(run)} size="lg" />
          </div>
          {run.source_url ? (
            <a
              href={run.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="pw-run-detail-github-link"
            >
              <ExternalLink size={13} aria-hidden />
              {t("viewOnGithub")}
            </a>
          ) : null}
        </div>

        <div className="pw-run-detail-stats">
          <div className="pw-run-detail-stat">
            <span className="pw-run-detail-stat-label">{t("stats.duration")}</span>
            <span className="pw-run-detail-stat-value">{headerDuration}</span>
          </div>
          <div className="pw-run-detail-stat">
            <span className="pw-run-detail-stat-label">{t("stats.started")}</span>
            <span className="pw-run-detail-stat-value">{formatRelativeTime(run.started_at)}</span>
          </div>
          <div className="pw-run-detail-stat">
            <span className="pw-run-detail-stat-label">{t("stats.completed")}</span>
            <span className="pw-run-detail-stat-value">
              {run.completed_at ? formatRelativeTime(run.completed_at) : emDash}
            </span>
          </div>
          <div className="pw-run-detail-stat">
            <span className="pw-run-detail-stat-label">{t("stats.trigger")}</span>
            <span className="pw-run-detail-trigger">{formatTriggerLabel(run.trigger_type, tTriggers)}</span>
          </div>
        </div>

        <div className="pw-run-detail-meta">
          <div className="pw-run-detail-commit-row">
            <span className="pw-run-detail-branch">{formatBranchDisplay(run.branch, emDash)}</span>
            {commitHref ? (
              <a
                href={commitHref}
                target="_blank"
                rel="noopener noreferrer"
                className="pw-run-detail-sha"
              >
                {shortSha}
              </a>
            ) : (
              <span className="pw-run-detail-sha">{shortSha}</span>
            )}
            {run.commit_message ? (
              <span className="pw-run-detail-commit-message">{run.commit_message}</span>
            ) : null}
          </div>
          <div className="pw-run-detail-actor">
            <Avatar
              {...(avatarUrl ? { src: avatarUrl } : {})}
              name={run.actor_login ?? t("unknownActor")}
              size="xs"
              rounded
            />
            <span>{run.actor_login ?? emDash}</span>
          </div>
        </div>
      </header>

      <JobGraph jobs={jobs} selectedJobId={highlightedJobId} onJobSelect={handleJobSelect} />

      <section className="pw-run-detail-jobs">
        <h2 className="pw-run-section-title">{t("jobs.title")}</h2>
        <div className="pw-run-detail-job-panels">
          {jobs.length === 0 ? (
            <p className="pw-run-detail-empty">{t("jobs.empty")}</p>
          ) : (
            jobs.map((job) => (
              <JobPanel
                key={job.id}
                job={job}
                steps={stepsByJobId[job.id] ?? []}
                expanded={expandedJobIds.has(job.id)}
                highlighted={highlightedJobId === job.id}
                onToggle={() => toggleJobPanel(job.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

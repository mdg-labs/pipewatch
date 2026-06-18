"use client";

import {
  RunPulse,
  Sparkline,
  StatusBadge,
  classNames,
} from "@pipewatch/ui";
import { formatDuration } from "@/lib/format-duration";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DashboardRepoCard } from "@/lib/dashboard-types";
import {
  averageFailureRate,
  formatElapsedSince,
  formatRelativeTime,
  githubRepoUrl,
  mapRunToBadgeStatus,
  parseRepoFullName,
} from "@/lib/dashboard-utils";
import { formatBranchDisplay, formatPipelineNameDisplay } from "@/lib/run-utils";

import "./dashboard.css";

export type DashboardRepoCardProps = {
  repo: DashboardRepoCard;
  workspaceSlug: string;
};

export function DashboardRepoCardView({ repo, workspaceSlug }: DashboardRepoCardProps) {
  const { org, name } = parseRepoFullName(repo.full_name);
  const badgeStatus = mapRunToBadgeStatus(repo.last_run, repo.is_running);
  const failureRate = averageFailureRate(repo.sparkline);
  const sparklineColor =
    failureRate >= 20
      ? "var(--status-failure)"
      : badgeStatus === "failure"
        ? "var(--status-failure)"
        : "var(--status-success)";

  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!repo.is_running || !repo.last_run?.started_at) {
      setElapsed(null);
      return;
    }

    const tick = () => {
      setElapsed(formatElapsedSince(repo.last_run!.started_at));
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [repo.is_running, repo.last_run?.started_at]);

  const detailHref = `/workspaces/${workspaceSlug}/repos/${repo.id}`;

  return (
    <Link href={detailHref} className="pw-dashboard-repo-card-link">
      <article className="pw-dashboard-repo-card">
        <div className="pw-dashboard-repo-card-head">
          <div className="pw-dashboard-repo-card-title">
            {org ? <div className="pw-dashboard-repo-card-org">{org}/</div> : null}
            <div className="pw-dashboard-repo-card-name">{name}</div>
          </div>
          <div className="pw-dashboard-repo-card-head-actions">
            <a
              href={githubRepoUrl(repo.full_name)}
              target="_blank"
              rel="noopener noreferrer"
              className="pw-dashboard-repo-github-link"
              aria-label={`Open ${repo.full_name} on GitHub`}
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink size={14} aria-hidden />
            </a>
            <StatusBadge status={badgeStatus} />
          </div>
        </div>

        {repo.last_run ? (
          <div className="pw-dashboard-repo-card-meta">
            <span className="pw-dashboard-repo-card-branch">
              {formatBranchDisplay(repo.last_run.branch)}
            </span>
            <span className="pw-dashboard-repo-card-workflow">
              {formatPipelineNameDisplay(repo.last_run.pipeline_name)}
            </span>
          </div>
        ) : null}

        {repo.is_running ? (
          <RunPulse size={7} label="running now" ring />
        ) : null}

        <p className="pw-dashboard-repo-card-timing">
          {repo.is_running && elapsed
            ? `running now — ${elapsed} elapsed`
            : repo.last_run
              ? `${formatRelativeTime(repo.last_run.started_at)} — ${formatDuration(
                  repo.last_run.duration_ms !== null
                    ? Math.round(repo.last_run.duration_ms / 1_000)
                    : null,
                )}`
              : "No runs yet"}
        </p>

        <div className="pw-dashboard-repo-card-foot">
          <span
            className={classNames(
              "pw-dashboard-repo-card-failure-rate",
              failureRate >= 20 && "pw-dashboard-repo-card-failure-rate-high",
            )}
          >
            {failureRate}% failure rate
          </span>
          <Sparkline
            data={repo.sparkline}
            width={80}
            height={18}
            color={sparklineColor}
            strokeWidth={1.5}
            showArea
          />
        </div>
      </article>
    </Link>
  );
}

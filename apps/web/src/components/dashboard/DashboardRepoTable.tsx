"use client";

import {
  DataTable,
  RunPulse,
  Sparkline,
  StatusBadge,
  type DataTableColumn,
} from "@pipewatch/ui";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { useTimeFormatters } from "@/i18n/use-time-formatters";
import type { DashboardRepoCard } from "@/lib/dashboard-types";
import {
  averageFailureRate,
  githubRepoUrl,
  mapRunToBadgeStatus,
  parseRepoFullName,
} from "@/lib/dashboard-utils";

import "./dashboard.css";

export type DashboardRepoTableProps = {
  repos: DashboardRepoCard[];
  workspaceSlug: string;
};

export function DashboardRepoTable({ repos, workspaceSlug }: DashboardRepoTableProps) {
  const router = useRouter();
  const t = useTranslations("dashboard.table");
  const { formatDuration, formatRelativeTime, emDash } = useTimeFormatters();

  const columns = useMemo<DataTableColumn<DashboardRepoCard>[]>(
    () => [
      {
        id: "repo",
        header: t("repository"),
        render: (repo) => {
          const { org, name } = parseRepoFullName(repo.full_name);
          return (
            <div className="pw-dashboard-table-repo">
              {org ? <span className="pw-dashboard-table-org">{org}/</span> : null}
              <span className="pw-dashboard-table-name">{name}</span>
              <a
                href={githubRepoUrl(repo.full_name)}
                target="_blank"
                rel="noopener noreferrer"
                className="pw-dashboard-repo-github-link"
                aria-label={t("openOnGithubAriaLabel", { fullName: repo.full_name })}
                onClick={(event) => event.stopPropagation()}
              >
                <ExternalLink size={14} aria-hidden />
              </a>
            </div>
          );
        },
      },
      {
        id: "workflow",
        header: t("lastWorkflow"),
        render: (repo) => repo.last_run?.pipeline_name ?? emDash,
      },
      {
        id: "branch",
        header: t("branch"),
        mono: true,
        render: (repo) => repo.last_run?.branch ?? emDash,
      },
      {
        id: "status",
        header: t("status"),
        render: (repo) => (
          <div className="pw-dashboard-table-status">
            {repo.is_running ? <RunPulse size={6} ring /> : null}
            <StatusBadge status={mapRunToBadgeStatus(repo.last_run, repo.is_running)} />
          </div>
        ),
      },
      {
        id: "last_run",
        header: t("lastRun"),
        render: (repo) =>
          repo.last_run ? formatRelativeTime(repo.last_run.started_at) : emDash,
      },
      {
        id: "duration",
        header: t("duration"),
        mono: true,
        render: (repo) =>
          formatDuration(
            repo.last_run?.duration_ms !== null && repo.last_run?.duration_ms !== undefined
              ? Math.round(repo.last_run.duration_ms / 1_000)
              : null,
          ),
      },
      {
        id: "failure_rate",
        header: t("sevenDayFailure"),
        align: "right",
        render: (repo) => {
          const rate = averageFailureRate(repo.sparkline);
          return (
            <div className="pw-dashboard-table-sparkline">
              <span>{rate}%</span>
              <Sparkline
                data={repo.sparkline}
                width={64}
                height={16}
                color={rate >= 20 ? "var(--status-failure)" : "var(--status-success)"}
                strokeWidth={1.5}
                showArea
              />
            </div>
          );
        },
      },
    ],
    [emDash, formatDuration, formatRelativeTime, t],
  );

  return (
    <DataTable
      columns={columns}
      rows={repos}
      getRowKey={(repo) => repo.id}
      onRowClick={(repo) => {
        router.push(`/workspaces/${workspaceSlug}/repos/${repo.id}`);
      }}
      emptyState={
        <p className="pw-dashboard-table-empty">{t("empty")}</p>
      }
    />
  );
}

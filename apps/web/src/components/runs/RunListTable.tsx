"use client";

import type { PipelineRun } from "@pipewatch/types";
import {
  Avatar,
  DataTable,
  StatusBadge,
  type DataTableColumn,
} from "@pipewatch/ui";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { formatTriggerLabel } from "@/i18n/trigger-labels";
import { useTimeFormatters } from "@/i18n/use-time-formatters";
import {
  formatBranchDisplay,
  formatPipelineNameDisplay,
  githubActorAvatarUrl,
  mapPipelineRunToBadgeStatus,
} from "@/lib/run-utils";

import "../repos/repo-detail.css";

export type RunListTableProps = {
  runs: PipelineRun[];
  workspaceSlug: string;
  repoId: string;
};

export function RunListTable({ runs, workspaceSlug, repoId }: RunListTableProps) {
  const router = useRouter();
  const t = useTranslations("runs.table");
  const tTriggers = useTranslations("runs.triggers");
  const tRuns = useTranslations("runs");
  const { formatDuration, formatRelativeTime, emDash } = useTimeFormatters();

  const columns = useMemo<DataTableColumn<PipelineRun>[]>(
    () => [
      {
        id: "workflow",
        header: t("workflow"),
        render: (run) => (
          <span className="pw-run-list-workflow">
            {formatPipelineNameDisplay(run.pipeline_name, emDash)}
          </span>
        ),
      },
      {
        id: "branch",
        header: t("branch"),
        render: (run) => (
          <span className="pw-run-list-branch">{formatBranchDisplay(run.branch, emDash)}</span>
        ),
      },
      {
        id: "trigger",
        header: t("trigger"),
        render: (run) => (
          <span className="pw-run-list-trigger">
            {formatTriggerLabel(run.trigger_type, tTriggers)}
          </span>
        ),
      },
      {
        id: "actor",
        header: t("actor"),
        render: (run) => {
          const avatarUrl = githubActorAvatarUrl(run.actor_login);
          return (
            <span className="pw-run-list-actor">
              <Avatar
                {...(avatarUrl ? { src: avatarUrl } : {})}
                name={run.actor_login ?? tRuns("unknownActor")}
                size="xs"
                rounded
              />
              <span className="pw-run-list-actor-login">{run.actor_login ?? emDash}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: t("status"),
        render: (run) => <StatusBadge status={mapPipelineRunToBadgeStatus(run)} />,
      },
      {
        id: "duration",
        header: t("duration"),
        align: "right",
        mono: true,
        render: (run) =>
          formatDuration(
            run.duration_ms !== null ? Math.round(run.duration_ms / 1_000) : null,
          ),
      },
      {
        id: "started",
        header: t("started"),
        render: (run) => formatRelativeTime(run.started_at),
      },
      {
        id: "chevron",
        header: "",
        render: () => <ChevronRight size={14} className="pw-run-list-chevron" aria-hidden />,
      },
    ],
    [emDash, formatDuration, formatRelativeTime, t, tRuns, tTriggers],
  );

  return (
    <div className="pw-run-list-table">
      <DataTable
        columns={columns}
        rows={runs}
        getRowKey={(run) => run.id}
        onRowClick={(run) => {
          router.push(`/workspaces/${workspaceSlug}/repos/${repoId}/runs/${run.id}`);
        }}
      />
    </div>
  );
}

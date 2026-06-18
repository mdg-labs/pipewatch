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
import { useMemo } from "react";

import { formatRelativeTime } from "@/lib/dashboard-utils";
import { formatDuration } from "@/lib/format-duration";
import {
  formatBranchDisplay,
  formatPipelineNameDisplay,
  formatTriggerLabel,
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

  const columns = useMemo<DataTableColumn<PipelineRun>[]>(
    () => [
      {
        id: "workflow",
        header: "Workflow",
        render: (run) => (
          <span className="pw-run-list-workflow">{formatPipelineNameDisplay(run.pipeline_name)}</span>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        render: (run) => (
          <span className="pw-run-list-branch">{formatBranchDisplay(run.branch)}</span>
        ),
      },
      {
        id: "trigger",
        header: "Trigger",
        render: (run) => (
          <span className="pw-run-list-trigger">{formatTriggerLabel(run.trigger_type)}</span>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        render: (run) => {
          const avatarUrl = githubActorAvatarUrl(run.actor_login);
          return (
            <span className="pw-run-list-actor">
              <Avatar
                {...(avatarUrl ? { src: avatarUrl } : {})}
                name={run.actor_login ?? "Unknown"}
                size="xs"
                rounded
              />
              <span className="pw-run-list-actor-login">{run.actor_login ?? "—"}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        render: (run) => <StatusBadge status={mapPipelineRunToBadgeStatus(run)} />,
      },
      {
        id: "duration",
        header: "Duration",
        align: "right",
        mono: true,
        render: (run) =>
          formatDuration(
            run.duration_ms !== null ? Math.round(run.duration_ms / 1_000) : null,
          ),
      },
      {
        id: "started",
        header: "Started",
        render: (run) => formatRelativeTime(run.started_at),
      },
      {
        id: "chevron",
        header: "",
        render: () => <ChevronRight size={14} className="pw-run-list-chevron" aria-hidden />,
      },
    ],
    [],
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

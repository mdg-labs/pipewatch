"use client";

import type {
  InsightsMostFailingWorkflow,
  InsightsRange,
  InsightsSlowestWorkflow,
} from "@pipewatch/types";
import { DataTable, type DataTableColumn } from "@pipewatch/ui";
import Link from "next/link";
import { useMemo } from "react";

import {
  buildWorkflowRunsHref,
  formatMsAsDuration,
  formatPercent,
  formatSignedPercent,
  resolveTrendTone,
} from "@/lib/insights-utils";

import "./insights.css";

export type InsightsTablesProps = {
  slowestWorkflows: InsightsSlowestWorkflow[];
  mostFailingWorkflows: InsightsMostFailingWorkflow[];
  workspaceSlug: string;
  range: InsightsRange;
};

function TrendIndicator({
  value,
  positiveIsGood,
}: {
  value: number | null | undefined;
  positiveIsGood: boolean;
}) {
  const tone = resolveTrendTone(value, positiveIsGood);
  const label = formatSignedPercent(value);

  if (!label) {
    return <span className="pw-insights-trend pw-insights-trend-neutral" aria-label="No trend">→</span>;
  }

  const arrow = tone === "up" ? "↑" : tone === "down" ? "↓" : "→";
  const className =
    tone === "up"
      ? "pw-insights-trend pw-insights-trend-up"
      : tone === "down"
        ? "pw-insights-trend pw-insights-trend-down"
        : "pw-insights-trend pw-insights-trend-neutral";

  return (
    <span className={className} aria-label={`Trend ${label}`}>
      {arrow}
    </span>
  );
}

function WorkflowLink({
  workflow,
  repoId,
  workspaceSlug,
  range,
}: {
  workflow: string;
  repoId: string;
  workspaceSlug: string;
  range: InsightsRange;
}) {
  return (
    <Link
      href={buildWorkflowRunsHref(workspaceSlug, repoId, workflow, range)}
      className="pw-insights-workflow-link"
    >
      {workflow}
    </Link>
  );
}

export function InsightsTables({
  slowestWorkflows,
  mostFailingWorkflows,
  workspaceSlug,
  range,
}: InsightsTablesProps) {
  const slowestColumns = useMemo<DataTableColumn<InsightsSlowestWorkflow>[]>(
    () => [
      {
        id: "workflow",
        header: "Workflow",
        render: (row) => (
          <WorkflowLink
            workflow={row.workflow}
            repoId={row.repo_id}
            workspaceSlug={workspaceSlug}
            range={range}
          />
        ),
      },
      {
        id: "avg",
        header: "Avg",
        align: "right",
        mono: true,
        render: (row) => formatMsAsDuration(row.avg_duration_ms),
      },
      {
        id: "p50",
        header: "p50",
        align: "right",
        mono: true,
        render: (row) => formatMsAsDuration(row.p50_duration_ms),
      },
      {
        id: "p95",
        header: "p95",
        align: "right",
        mono: true,
        render: (row) => formatMsAsDuration(row.p95_duration_ms),
      },
      {
        id: "trend",
        header: "",
        align: "right",
        render: (row) => <TrendIndicator value={row.trend_percent} positiveIsGood={false} />,
      },
    ],
    [range, workspaceSlug],
  );

  const failingColumns = useMemo<DataTableColumn<InsightsMostFailingWorkflow>[]>(
    () => [
      {
        id: "workflow",
        header: "Workflow",
        render: (row) => (
          <WorkflowLink
            workflow={row.workflow}
            repoId={row.repo_id}
            workspaceSlug={workspaceSlug}
            range={range}
          />
        ),
      },
      {
        id: "rate",
        header: "Rate",
        align: "right",
        mono: true,
        render: (row) => (
          <span
            className={
              row.failure_rate >= 10
                ? "pw-insights-failure-rate-high"
                : "pw-insights-failure-rate"
            }
          >
            {formatPercent(row.failure_rate)}
          </span>
        ),
      },
      {
        id: "count",
        header: "# Failures",
        align: "right",
        mono: true,
        render: (row) => row.failure_count,
      },
      {
        id: "trend",
        header: "",
        align: "right",
        render: (row) => <TrendIndicator value={row.trend_percent} positiveIsGood={false} />,
      },
    ],
    [range, workspaceSlug],
  );

  return (
    <div className="pw-insights-tables-grid">
      <section className="pw-insights-table-card">
        <header className="pw-insights-table-header">
          <h2 className="pw-insights-table-title">Slowest workflows</h2>
          <span className="pw-insights-table-subtitle">avg duration</span>
        </header>
        <DataTable
          columns={slowestColumns}
          rows={slowestWorkflows}
          getRowKey={(row) => `${row.repo_id}:${row.workflow}`}
        />
      </section>

      <section className="pw-insights-table-card">
        <header className="pw-insights-table-header">
          <h2 className="pw-insights-table-title">Most failing workflows</h2>
          <span className="pw-insights-table-subtitle">failure rate</span>
        </header>
        <DataTable
          columns={failingColumns}
          rows={mostFailingWorkflows}
          getRowKey={(row) => `${row.repo_id}:${row.workflow}`}
        />
      </section>
    </div>
  );
}

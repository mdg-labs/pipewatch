"use client";

import type {
  InsightsMostFailingWorkflow,
  InsightsRange,
  InsightsSlowestWorkflow,
} from "@pipewatch/types";
import { DataTable, classNames, type DataTableColumn } from "@pipewatch/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { formatPercent, formatSignedPercent } from "@/i18n/insights-formatters";
import { useInsightsFormatters } from "@/i18n/use-insights-formatters";
import { buildWorkflowRunsHref, resolveTrendTone } from "@/lib/insights-utils";

import "./insights.css";

export type InsightsTablesProps = {
  slowestWorkflows: InsightsSlowestWorkflow[];
  mostFailingWorkflows: InsightsMostFailingWorkflow[];
  workspaceSlug: string;
  range: InsightsRange;
  showSlowest?: boolean;
};

function TrendIndicator({
  value,
  positiveIsGood,
  noTrendAriaLabel,
  trendAriaLabel,
}: {
  value: number | null | undefined;
  positiveIsGood: boolean;
  noTrendAriaLabel: string;
  trendAriaLabel: (label: string) => string;
}) {
  const tone = resolveTrendTone(value, positiveIsGood);
  const label = formatSignedPercent(value);

  if (!label) {
    return (
      <span className="pw-insights-trend pw-insights-trend-neutral" aria-label={noTrendAriaLabel}>
        →
      </span>
    );
  }

  const arrow = tone === "up" ? "↑" : tone === "down" ? "↓" : "→";
  const className =
    tone === "up"
      ? "pw-insights-trend pw-insights-trend-up"
      : tone === "down"
        ? "pw-insights-trend pw-insights-trend-down"
        : "pw-insights-trend pw-insights-trend-neutral";

  return (
    <span className={className} aria-label={trendAriaLabel(label)}>
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
  showSlowest = true,
}: InsightsTablesProps) {
  const t = useTranslations("insights.tables");
  const { formatMsAsDuration } = useInsightsFormatters();

  const slowestColumns = useMemo<DataTableColumn<InsightsSlowestWorkflow>[]>(
    () => [
      {
        id: "workflow",
        header: t("workflow"),
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
        header: t("avg"),
        align: "right",
        mono: true,
        render: (row) => formatMsAsDuration(row.avg_duration_ms),
      },
      {
        id: "p50",
        header: t("p50"),
        align: "right",
        mono: true,
        render: (row) => formatMsAsDuration(row.p50_duration_ms),
      },
      {
        id: "p95",
        header: t("p95"),
        align: "right",
        mono: true,
        render: (row) => formatMsAsDuration(row.p95_duration_ms),
      },
      {
        id: "trend",
        header: "",
        align: "right",
        render: (row) => (
          <TrendIndicator
            value={row.trend_percent}
            positiveIsGood={false}
            noTrendAriaLabel={t("noTrendAriaLabel")}
            trendAriaLabel={(label) => t("trendAriaLabel", { label })}
          />
        ),
      },
    ],
    [formatMsAsDuration, range, t, workspaceSlug],
  );

  const failingColumns = useMemo<DataTableColumn<InsightsMostFailingWorkflow>[]>(
    () => [
      {
        id: "workflow",
        header: t("workflow"),
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
        header: t("rate"),
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
        header: t("failureCount"),
        align: "right",
        mono: true,
        render: (row) => row.failure_count,
      },
      {
        id: "trend",
        header: "",
        align: "right",
        render: (row) => (
          <TrendIndicator
            value={row.trend_percent}
            positiveIsGood={false}
            noTrendAriaLabel={t("noTrendAriaLabel")}
            trendAriaLabel={(label) => t("trendAriaLabel", { label })}
          />
        ),
      },
    ],
    [range, t, workspaceSlug],
  );

  return (
    <div
      className={classNames(
        "pw-insights-tables-grid",
        !showSlowest && "pw-insights-tables-grid-single",
      )}
    >
      {showSlowest ? (
        <section className="pw-insights-table-card">
          <header className="pw-insights-table-header">
            <h2 className="pw-insights-table-title">{t("slowestTitle")}</h2>
            <span className="pw-insights-table-subtitle">{t("slowestSubtitle")}</span>
          </header>
          <DataTable
            columns={slowestColumns}
            rows={slowestWorkflows}
            getRowKey={(row) => `${row.repo_id}:${row.workflow}`}
          />
        </section>
      ) : null}

      <section className="pw-insights-table-card">
        <header className="pw-insights-table-header">
          <h2 className="pw-insights-table-title">{t("mostFailingTitle")}</h2>
          <span className="pw-insights-table-subtitle">{t("mostFailingSubtitle")}</span>
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

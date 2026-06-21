import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { BarChart, Card, DataTable, Pagination } from "@pipewatch/ui";

import { apiFetch, buildQueryString } from "../api/client.js";
import type {
  PaginatedResult,
  PlatformMetricsSummary,
  PlatformMetricsWorkspace,
} from "../api/types.js";
import {
  AsyncBoundary,
  CardGridSkeleton,
  TableSkeleton,
} from "../components/AsyncBoundary.js";
import { OverviewStatCards } from "../components/OverviewStatCards.js";
import { useApiQuery } from "../hooks/use-api-query.js";
import { formatCount } from "../lib/format.js";

const WORKSPACE_PAGE_SIZE = 25;
const TOP_WORKSPACES_LIMIT = 10;
const CHART_FETCH_SIZE = 100;

const PLAN_CHART_SERIES = [{ id: "workspaces", label: "Workspaces" }];

const PIPELINE_RUNS_SERIES = [{ id: "runs", label: "Pipeline runs" }];

export function OverviewPage() {
  const [page, setPage] = useState(1);

  const summaryQuery = useApiQuery(
    () => apiFetch<PlatformMetricsSummary>("/api/platform-metrics/summary"),
    [],
  );

  const workspacesQuery = useApiQuery(
    () =>
      apiFetch<PaginatedResult<PlatformMetricsWorkspace>>(
        `/api/platform-metrics/workspaces${buildQueryString({
          page,
          page_size: WORKSPACE_PAGE_SIZE,
        })}`,
      ),
    [page],
  );

  const chartWorkspacesQuery = useApiQuery(
    () =>
      apiFetch<PaginatedResult<PlatformMetricsWorkspace>>(
        `/api/platform-metrics/workspaces${buildQueryString({
          page: 1,
          page_size: CHART_FETCH_SIZE,
        })}`,
      ),
    [],
  );

  const planChartData = useMemo(() => {
    if (!summaryQuery.data) {
      return [];
    }

    const { workspacesByPlan } = summaryQuery.data;
    return [
      { label: "Free", values: [workspacesByPlan.free] },
      { label: "Pro", values: [workspacesByPlan.pro] },
      { label: "Business", values: [workspacesByPlan.business] },
    ];
  }, [summaryQuery.data]);

  const pipelineRunsChartData = useMemo(() => {
    const items = chartWorkspacesQuery.data?.items ?? [];
    return [...items]
      .sort((left, right) => right.pipelineRunCount - left.pipelineRunCount)
      .slice(0, TOP_WORKSPACES_LIMIT)
      .map((workspace) => ({
        label: workspace.slug,
        values: [workspace.pipelineRunCount],
      }));
  }, [chartWorkspacesQuery.data]);

  const workspaceColumns = [
    {
      id: "name",
      header: "Workspace",
      render: (row: PlatformMetricsWorkspace) => (
        <Link className="admin-detail-link" to={`/workspaces/${row.id}`}>
          <strong>{row.name}</strong>
          <div className="admin-muted">{row.slug}</div>
        </Link>
      ),
    },
    {
      id: "members",
      header: "Members",
      align: "right" as const,
      render: (row: PlatformMetricsWorkspace) => formatCount(row.memberCount),
    },
    {
      id: "integrations",
      header: "Integrations",
      align: "right" as const,
      render: (row: PlatformMetricsWorkspace) => formatCount(row.integrationCount),
    },
    {
      id: "pipelineRuns",
      header: "Pipeline runs",
      align: "right" as const,
      render: (row: PlatformMetricsWorkspace) => formatCount(row.pipelineRunCount),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Overview</h1>
        <p className="admin-muted">
          Platform-wide workspace, user, and pipeline run metrics.
        </p>
      </header>

      <AsyncBoundary
        loading={summaryQuery.loading}
        error={summaryQuery.error}
        onRetry={summaryQuery.retry}
        skeleton={<CardGridSkeleton count={4} />}
      >
        {summaryQuery.data ? <OverviewStatCards summary={summaryQuery.data} /> : null}
      </AsyncBoundary>

      <section className="admin-section" aria-label="Platform charts">
        <div className="admin-chart-row">
          <AsyncBoundary
            loading={summaryQuery.loading}
            error={summaryQuery.error}
            onRetry={summaryQuery.retry}
            skeleton={<CardGridSkeleton count={1} />}
          >
            {summaryQuery.data ? (
              <Card className="admin-chart-card">
                <h2 className="admin-card-title">Workspaces by plan</h2>
                <BarChart
                  data={planChartData}
                  series={PLAN_CHART_SERIES}
                  width={360}
                  height={220}
                  ariaLabel="Workspaces by plan"
                />
              </Card>
            ) : null}
          </AsyncBoundary>

          <AsyncBoundary
            loading={chartWorkspacesQuery.loading}
            error={chartWorkspacesQuery.error}
            onRetry={chartWorkspacesQuery.retry}
            skeleton={<CardGridSkeleton count={1} />}
          >
            {chartWorkspacesQuery.data ? (
              <Card className="admin-chart-card">
                <h2 className="admin-card-title">
                  Pipeline runs per workspace (top {TOP_WORKSPACES_LIMIT})
                </h2>
                {pipelineRunsChartData.length > 0 ? (
                  <BarChart
                    data={pipelineRunsChartData}
                    series={PIPELINE_RUNS_SERIES}
                    width={520}
                    height={220}
                    ariaLabel="Pipeline runs per workspace"
                  />
                ) : (
                  <p className="admin-muted">No pipeline runs recorded yet.</p>
                )}
              </Card>
            ) : null}
          </AsyncBoundary>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Workspace rollup</h2>
        <Card className="admin-table-card">
          <AsyncBoundary
            loading={workspacesQuery.loading}
            error={workspacesQuery.error}
            onRetry={workspacesQuery.retry}
            skeleton={<TableSkeleton rows={8} />}
          >
            {workspacesQuery.data ? (
              <>
                <DataTable
                  columns={workspaceColumns}
                  rows={workspacesQuery.data.items}
                  getRowKey={(row) => row.id}
                  emptyState="No workspaces found."
                />
                <Pagination
                  page={page}
                  totalItems={workspacesQuery.data.total}
                  pageSize={WORKSPACE_PAGE_SIZE}
                  onPageChange={setPage}
                  labels={{
                    summary: `${String(workspacesQuery.data.total)} workspaces`,
                    prev: "Previous",
                    next: "Next",
                    previousPageAriaLabel: "Previous page",
                    nextPageAriaLabel: "Next page",
                    pagesAriaLabel: "Workspace rollup pages",
                    pageAriaLabel: (value) => `Page ${String(value)}`,
                  }}
                />
              </>
            ) : null}
          </AsyncBoundary>
        </Card>
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";

import { Badge, Card, DataTable, Pagination } from "@pipewatch/ui";

import { apiFetch, buildQueryString } from "../api/client.js";
import type {
  IntegrationOverview,
  PaginatedResult,
  WebhookHealthSummary,
} from "../api/types.js";
import { formatDateTime, formatPercent } from "../lib/format.js";
import {
  AsyncBoundary,
  TableSkeleton,
} from "../components/AsyncBoundary.js";
import { useApiQuery } from "../hooks/use-api-query.js";

const PAGE_SIZE = 25;

export function InstallationsPage() {
  const [page, setPage] = useState(1);

  const integrationsQuery = useApiQuery(
    () =>
      apiFetch<PaginatedResult<IntegrationOverview>>(
        `/api/integrations${buildQueryString({ page, page_size: PAGE_SIZE })}`,
      ),
    [page],
  );

  const healthQuery = useApiQuery(
    () => apiFetch<WebhookHealthSummary>("/api/webhook-health/summary"),
    [],
  );

  const healthByInstallation = useMemo(() => {
    const map = new Map<string, { failureRate: number; unreachableCount: number }>();
    for (const row of healthQuery.data?.installations ?? []) {
      map.set(row.externalInstallationId, {
        failureRate: row.failureRate,
        unreachableCount: row.unreachableCount,
      });
    }
    return map;
  }, [healthQuery.data]);

  const columns = [
    {
      id: "account",
      header: "GitHub account",
      render: (row: IntegrationOverview) => (
        <div>
          <strong>{row.accountLogin}</strong>
          <div className="admin-muted">{row.accountType}</div>
        </div>
      ),
    },
    {
      id: "workspace",
      header: "Workspace",
      render: (row: IntegrationOverview) => (
        <div>
          <strong>{row.workspace.name}</strong>
          <div className="admin-muted">{row.workspace.slug}</div>
        </div>
      ),
    },
    {
      id: "installation",
      header: "Installation ID",
      mono: true,
      render: (row: IntegrationOverview) => row.externalInstallationId,
    },
    {
      id: "health",
      header: "Delivery health",
      render: (row: IntegrationOverview) => {
        const health = healthByInstallation.get(row.externalInstallationId);
        if (!health) {
          return <span className="admin-muted">No recent deliveries</span>;
        }

        return (
          <div className="admin-health-cell">
            <span>{formatPercent(health.failureRate)} failure</span>
            {health.unreachableCount > 0 ? (
              <Badge variant="failure">{health.unreachableCount} unreachable</Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "createdAt",
      header: "Connected",
      render: (row: IntegrationOverview) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Installations</h1>
        <p className="admin-muted">
          GitHub App installations linked to workspaces with recent delivery health.
        </p>
      </header>

      <Card className="admin-table-card">
        <AsyncBoundary
          loading={integrationsQuery.loading}
          error={integrationsQuery.error}
          onRetry={integrationsQuery.retry}
          skeleton={<TableSkeleton rows={8} />}
        >
          {integrationsQuery.data ? (
            <>
              <DataTable
                columns={columns}
                rows={integrationsQuery.data.items}
                getRowKey={(row) => row.id}
                emptyState="No installations found."
              />
              <Pagination
                page={page}
                totalItems={integrationsQuery.data.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                labels={{
                  summary: `${String(integrationsQuery.data.total)} installations`,
                  prev: "Previous",
                  next: "Next",
                  previousPageAriaLabel: "Previous page",
                  nextPageAriaLabel: "Next page",
                  pagesAriaLabel: "Installation pages",
                  pageAriaLabel: (value) => `Page ${String(value)}`,
                }}
              />
            </>
          ) : null}
        </AsyncBoundary>
      </Card>
    </div>
  );
}

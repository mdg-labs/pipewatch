import { Link } from "react-router-dom";

import { Card, DataTable, Pagination } from "@pipewatch/ui";
import { useState } from "react";

import { apiFetch, buildQueryString } from "../api/client.js";
import type { PaginatedResult, WorkspaceOverview } from "../api/types.js";
import { formatDateTime } from "../lib/format.js";
import {
  AsyncBoundary,
  TableSkeleton,
} from "../components/AsyncBoundary.js";
import { useApiQuery } from "../hooks/use-api-query.js";

const PAGE_SIZE = 25;

export function WorkspacesPage() {
  const [page, setPage] = useState(1);

  const query = useApiQuery(
    () =>
      apiFetch<PaginatedResult<WorkspaceOverview>>(
        `/api/workspaces${buildQueryString({ page, page_size: PAGE_SIZE })}`,
      ),
    [page],
  );

  const columns = [
    {
      id: "name",
      header: "Workspace",
      render: (row: WorkspaceOverview) => (
        <Link className="admin-detail-link" to={`/workspaces/${row.id}`}>
          <strong>{row.name}</strong>
          <div className="admin-muted">{row.slug}</div>
        </Link>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      render: (row: WorkspaceOverview) => row.plan,
    },
    {
      id: "integrations",
      header: "Integrations",
      align: "right" as const,
      render: (row: WorkspaceOverview) => row.integrationCount,
    },
    {
      id: "members",
      header: "Members",
      align: "right" as const,
      render: (row: WorkspaceOverview) => row.memberCount,
    },
    {
      id: "createdAt",
      header: "Created",
      render: (row: WorkspaceOverview) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Workspaces</h1>
        <p className="admin-muted">Cloud workspaces with plan and membership counts.</p>
      </header>

      <Card className="admin-table-card">
        <AsyncBoundary
          loading={query.loading}
          error={query.error}
          onRetry={query.retry}
          skeleton={<TableSkeleton rows={8} />}
        >
          {query.data ? (
            <>
              <DataTable
                columns={columns}
                rows={query.data.items}
                getRowKey={(row) => row.id}
                emptyState="No workspaces found."
              />
              <Pagination
                page={page}
                totalItems={query.data.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                labels={{
                  summary: `${String(query.data.total)} workspaces`,
                  prev: "Previous",
                  next: "Next",
                  previousPageAriaLabel: "Previous page",
                  nextPageAriaLabel: "Next page",
                  pagesAriaLabel: "Workspace pages",
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

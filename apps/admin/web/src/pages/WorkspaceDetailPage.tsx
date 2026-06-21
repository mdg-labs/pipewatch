import { Link, useParams } from "react-router-dom";

import { Badge, Card, DataTable } from "@pipewatch/ui";

import { apiFetch } from "../api/client.js";
import type {
  WorkspaceDetail,
  WorkspaceIntegrationSummary,
  WorkspaceMemberSummary,
} from "../api/types.js";
import {
  AsyncBoundary,
  CardGridSkeleton,
} from "../components/AsyncBoundary.js";
import { DeliveryTable } from "../components/DeliveryTable.js";
import { useApiQuery } from "../hooks/use-api-query.js";
import { formatDateTime, formatPercent } from "../lib/format.js";

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useApiQuery(
    () => apiFetch<WorkspaceDetail>(`/api/workspaces/${id}`),
    [id],
  );

  const memberColumns = [
    {
      id: "email",
      header: "Email",
      render: (row: WorkspaceMemberSummary) => row.email ?? "—",
    },
    {
      id: "role",
      header: "Role",
      render: (row: WorkspaceMemberSummary) => row.role,
    },
    {
      id: "userId",
      header: "User ID",
      mono: true,
      render: (row: WorkspaceMemberSummary) => row.userId,
    },
  ];

  const installationColumns = [
    {
      id: "account",
      header: "GitHub account",
      render: (row: WorkspaceIntegrationSummary) => (
        <Link className="admin-detail-link" to={`/installations/${row.id}`}>
          <strong>{row.accountLogin}</strong>
          <div className="admin-muted">{row.accountType}</div>
        </Link>
      ),
    },
    {
      id: "installation",
      header: "Installation ID",
      mono: true,
      render: (row: WorkspaceIntegrationSummary) => row.externalInstallationId,
    },
    {
      id: "connected",
      header: "Connected",
      render: (row: WorkspaceIntegrationSummary) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <p className="admin-muted">
          <Link className="admin-detail-link" to="/workspaces">
            Workspaces
          </Link>
        </p>
        <h1>{query.data?.name ?? "Workspace"}</h1>
        {query.data ? (
          <p className="admin-muted">
            {query.data.slug} · <Badge variant="outline">{query.data.plan}</Badge>
          </p>
        ) : null}
      </header>

      <AsyncBoundary
        loading={query.loading}
        error={query.error}
        onRetry={query.retry}
        skeleton={<CardGridSkeleton count={3} />}
      >
        {query.data ? (
          <>
            <Card className="admin-table-card">
              <h2 className="admin-card-title">Metadata</h2>
              <dl className="admin-dl">
                <div>
                  <dt>Workspace ID</dt>
                  <dd>{query.data.id}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>{query.data.plan}</dd>
                </div>
                <div>
                  <dt>Default retention</dt>
                  <dd>{query.data.defaultRetentionDays} days</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(query.data.createdAt)}</dd>
                </div>
                <div>
                  <dt>Integrations</dt>
                  <dd>{query.data.integrationCount}</dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>{query.data.memberCount}</dd>
                </div>
              </dl>
            </Card>

            <Card className="admin-table-card">
              <h2 className="admin-card-title">
                Recent webhook health ({query.data.recentWebhookHealth.windowMinutes}m)
              </h2>
              <dl className="admin-dl">
                <div>
                  <dt>Deliveries</dt>
                  <dd>{query.data.recentWebhookHealth.total}</dd>
                </div>
                <div>
                  <dt>Failure rate</dt>
                  <dd>{formatPercent(query.data.recentWebhookHealth.failureRate)}</dd>
                </div>
                <div>
                  <dt>Unreachable</dt>
                  <dd>{query.data.recentWebhookHealth.unreachableCount}</dd>
                </div>
              </dl>
            </Card>

            <section className="admin-section">
              <h2 className="admin-section-title">Members</h2>
              <Card className="admin-table-card">
                <DataTable
                  columns={memberColumns}
                  rows={query.data.members}
                  getRowKey={(row) => row.userId}
                  emptyState="No members in this workspace."
                />
              </Card>
            </section>

            <section className="admin-section">
              <h2 className="admin-section-title">Installations</h2>
              <Card className="admin-table-card">
                <DataTable
                  columns={installationColumns}
                  rows={query.data.integrations}
                  getRowKey={(row) => row.id}
                  emptyState="No GitHub installations linked."
                />
              </Card>
            </section>

            <section className="admin-section">
              <h2 className="admin-section-title">Webhook deliveries</h2>
              <DeliveryTable initialQuery={{ workspace_id: query.data.id }} />
            </section>
          </>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}

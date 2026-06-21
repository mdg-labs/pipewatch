import { Link, useParams } from "react-router-dom";

import { Card } from "@pipewatch/ui";

import { apiFetch } from "../api/client.js";
import type { IntegrationDetail } from "../api/types.js";
import {
  AsyncBoundary,
  CardGridSkeleton,
} from "../components/AsyncBoundary.js";
import { DeliveryTable } from "../components/DeliveryTable.js";
import { useApiQuery } from "../hooks/use-api-query.js";
import { formatDateTime, formatPercent } from "../lib/format.js";

export function InstallationDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useApiQuery(
    () => apiFetch<IntegrationDetail>(`/api/integrations/${id}`),
    [id],
  );

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <p className="admin-muted">
          <Link className="admin-detail-link" to="/installations">
            Installations
          </Link>
        </p>
        <h1>{query.data?.accountLogin ?? "Installation"}</h1>
        {query.data ? (
          <p className="admin-muted">{query.data.accountType} GitHub account</p>
        ) : null}
      </header>

      <AsyncBoundary
        loading={query.loading}
        error={query.error}
        onRetry={query.retry}
        skeleton={<CardGridSkeleton count={2} />}
      >
        {query.data ? (
          <>
            <Card className="admin-table-card">
              <h2 className="admin-card-title">Installation</h2>
              <dl className="admin-dl">
                <div>
                  <dt>Integration ID</dt>
                  <dd>{query.data.id}</dd>
                </div>
                <div>
                  <dt>GitHub installation ID</dt>
                  <dd>{query.data.externalInstallationId}</dd>
                </div>
                <div>
                  <dt>Account login</dt>
                  <dd>{query.data.accountLogin}</dd>
                </div>
                <div>
                  <dt>Account type</dt>
                  <dd>{query.data.accountType}</dd>
                </div>
                <div>
                  <dt>Connected</dt>
                  <dd>{formatDateTime(query.data.createdAt)}</dd>
                </div>
                <div>
                  <dt>Workspace</dt>
                  <dd>
                    <Link
                      className="admin-detail-link"
                      to={`/workspaces/${query.data.workspace.id}`}
                    >
                      {query.data.workspace.name} ({query.data.workspace.slug})
                    </Link>
                  </dd>
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
              <h2 className="admin-section-title">Webhook deliveries</h2>
              <DeliveryTable
                initialQuery={{
                  installation_id: query.data.externalInstallationId,
                }}
              />
            </section>
          </>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}

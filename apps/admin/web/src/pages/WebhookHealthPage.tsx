import { apiFetch } from "../api/client.js";
import type {
  WebhookHealthSummary,
  WebhookPollCoverage,
} from "../api/types.js";
import {
  AsyncBoundary,
  CardGridSkeleton,
} from "../components/AsyncBoundary.js";
import { DeliveryTable } from "../components/DeliveryTable.js";
import { FailureRateChart } from "../components/FailureRateChart.js";
import { InstallationBreakdownTable } from "../components/InstallationBreakdownTable.js";
import { PollCoverageCard } from "../components/PollCoverageCard.js";
import { useApiQuery } from "../hooks/use-api-query.js";

export function WebhookHealthPage() {
  const summaryQuery = useApiQuery(
    () => apiFetch<WebhookHealthSummary>("/api/webhook-health/summary"),
    [],
  );
  const coverageQuery = useApiQuery(
    () => apiFetch<WebhookPollCoverage>("/api/webhook-health/coverage"),
    [],
  );

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Webhook health</h1>
        <p className="admin-muted">
          Delivery failure rates, poll coverage, and recent webhook deliveries.
        </p>
      </header>

      <AsyncBoundary
        loading={summaryQuery.loading}
        error={summaryQuery.error}
        onRetry={summaryQuery.retry}
        skeleton={<CardGridSkeleton count={3} />}
      >
        {summaryQuery.data ? (
          <>
            <FailureRateChart summary={summaryQuery.data} />
            <InstallationBreakdownTable
              installations={summaryQuery.data.installations}
            />
          </>
        ) : null}
      </AsyncBoundary>

      <AsyncBoundary
        loading={coverageQuery.loading}
        error={coverageQuery.error}
        onRetry={coverageQuery.retry}
        skeleton={<CardGridSkeleton count={1} />}
      >
        {coverageQuery.data ? <PollCoverageCard coverage={coverageQuery.data} /> : null}
      </AsyncBoundary>

      <section className="admin-section">
        <h2 className="admin-section-title">Recent deliveries</h2>
        <DeliveryTable />
      </section>
    </div>
  );
}

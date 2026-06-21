import { Card } from "@pipewatch/ui";

import type { WebhookPollCoverage } from "../api/types.js";
import { formatDateTime, formatDurationSeconds } from "../lib/format.js";

const POLL_FRESHNESS_WARN_SECONDS = 180;
const INGEST_LAG_WARN_SECONDS = 300;

type PollCoverageCardProps = {
  coverage: WebhookPollCoverage;
};

export function PollCoverageCard({ coverage }: PollCoverageCardProps) {
  const freshnessWarning =
    coverage.pollFreshnessSeconds !== null &&
    coverage.pollFreshnessSeconds > POLL_FRESHNESS_WARN_SECONDS;
  const ingestWarning =
    coverage.ingestLagSeconds !== null &&
    coverage.ingestLagSeconds > INGEST_LAG_WARN_SECONDS;
  const showWarning = freshnessWarning || ingestWarning;

  return (
    <Card className="admin-coverage-card">
      <h2 className="admin-card-title">Poll coverage</h2>
      <p className="admin-coverage-helper">
        Last delivery age reflects webhook volume, not ingest health.
      </p>
      <dl className="admin-dl">
        <div>
          <dt>Last delivery</dt>
          <dd>{formatDateTime(coverage.lastDeliveryAt)}</dd>
        </div>
        <div>
          <dt>Poll freshness</dt>
          <dd className={freshnessWarning ? "admin-text-warning" : undefined}>
            {formatDurationSeconds(coverage.pollFreshnessSeconds)}
          </dd>
        </div>
        <div>
          <dt>Ingest lag (newest delivery)</dt>
          <dd className={ingestWarning ? "admin-text-warning" : undefined}>
            {formatDurationSeconds(coverage.ingestLagSeconds)}
          </dd>
        </div>
      </dl>
      {showWarning ? (
        <p className="admin-text-warning" role="status">
          {freshnessWarning && ingestWarning
            ? "Poll freshness and ingest lag exceed thresholds — check the poll job."
            : freshnessWarning
              ? "Poll freshness exceeds 3 minutes — the poll job may be stalled."
              : "Ingest lag on the newest delivery exceeds 5 minutes — ingest may be behind."}
        </p>
      ) : null}
    </Card>
  );
}

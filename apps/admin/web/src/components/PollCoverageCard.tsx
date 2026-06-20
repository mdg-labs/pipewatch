import { Card } from "@pipewatch/ui";

import type { WebhookPollCoverage } from "../api/types.js";
import { formatDateTime, formatDurationSeconds } from "../lib/format.js";

type PollCoverageCardProps = {
  coverage: WebhookPollCoverage;
};

export function PollCoverageCard({ coverage }: PollCoverageCardProps) {
  const lagWarning =
    coverage.pollLagSeconds !== null && coverage.pollLagSeconds > 300;

  return (
    <Card className="admin-coverage-card">
      <h2 className="admin-card-title">Poll coverage</h2>
      <dl className="admin-dl">
        <div>
          <dt>Latest delivery</dt>
          <dd>{formatDateTime(coverage.latestDeliveredAt)}</dd>
        </div>
        <div>
          <dt>Latest poll</dt>
          <dd>{formatDateTime(coverage.latestPolledAt)}</dd>
        </div>
        <div>
          <dt>Poll lag</dt>
          <dd className={lagWarning ? "admin-text-warning" : undefined}>
            {formatDurationSeconds(coverage.pollLagSeconds)}
          </dd>
        </div>
      </dl>
      {lagWarning ? (
        <p className="admin-text-warning" role="status">
          Poll lag exceeds 5 minutes — ingest may be behind.
        </p>
      ) : null}
    </Card>
  );
}

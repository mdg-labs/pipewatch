import { useMemo } from "react";

import { BarChart, Card, StatCard } from "@pipewatch/ui";

import type { WebhookHealthSummary } from "../api/types.js";
import { formatPercent } from "../lib/format.js";

type FailureRateChartProps = {
  summary: WebhookHealthSummary;
};

export function FailureRateChart({ summary }: FailureRateChartProps) {
  const { overall, installations } = summary;

  const chartData = useMemo(
    () =>
      installations.slice(0, 12).map((row) => ({
        label: row.externalInstallationId,
        values: [
          row.failureCount,
          Math.max(0, row.successCount),
        ],
      })),
    [installations],
  );

  const chartSeries = useMemo(
    () => [
      { id: "failures", label: "Failures", color: "var(--status-failure)" },
      { id: "success", label: "Success", color: "var(--status-success)" },
    ],
    [],
  );

  return (
    <section className="admin-section" aria-label="Webhook failure overview">
      <div className="admin-stat-grid">
        <StatCard
          label="Total deliveries"
          value={overall.total}
          mono
        />
        <StatCard
          label="Failure rate"
          value={formatPercent(overall.failureRate)}
          trend={`${overall.failureCount} failures`}
        />
        <StatCard
          label="Unreachable"
          value={overall.unreachableCount}
          trend="status_code = 0"
        />
      </div>

      <Card className="admin-chart-card">
        <h2 className="admin-card-title">
          Failure rate by installation ({summary.windowMinutes}m window)
        </h2>
        {chartData.length > 0 ? (
          <BarChart
            data={chartData}
            series={chartSeries}
            width={720}
            height={240}
            ariaLabel="Failure rate by installation"
          />
        ) : (
          <p className="admin-muted">No deliveries in the selected window.</p>
        )}
      </Card>
    </section>
  );
}

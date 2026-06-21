import { StatCard } from "@pipewatch/ui";

import type { PlatformMetricsSummary } from "../api/types.js";
import { formatCount } from "../lib/format.js";

type OverviewStatCardsProps = {
  summary: PlatformMetricsSummary;
};

/** Platform-wide stat cards for the admin overview home page. */
export function OverviewStatCards({ summary }: OverviewStatCardsProps) {
  return (
    <div className="admin-stat-grid">
      <StatCard label="Workspaces" value={formatCount(summary.totalWorkspaces)} />
      <StatCard label="Product users" value={formatCount(summary.totalProductUsers)} />
      <StatCard
        label="Pipeline runs"
        value={formatCount(summary.totalPipelineRuns)}
        trend={`${formatCount(summary.pipelineRunsLast30Days)} in last 30 days`}
      />
      <StatCard label="Integrations" value={formatCount(summary.totalIntegrations)} />
    </div>
  );
}

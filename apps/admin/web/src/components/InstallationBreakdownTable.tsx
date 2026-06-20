import { Card, DataTable } from "@pipewatch/ui";

import type { WebhookHealthInstallation } from "../api/types.js";
import { formatPercent, truncateId } from "../lib/format.js";

type InstallationBreakdownTableProps = {
  installations: WebhookHealthInstallation[];
};

export function InstallationBreakdownTable({
  installations,
}: InstallationBreakdownTableProps) {
  const columns = [
    {
      id: "installation",
      header: "Installation",
      mono: true,
      render: (row: WebhookHealthInstallation) =>
        truncateId(row.externalInstallationId, 12),
    },
    {
      id: "workspace",
      header: "Workspace",
      mono: true,
      render: (row: WebhookHealthInstallation) =>
        row.workspaceId ? truncateId(row.workspaceId, 12) : "—",
    },
    {
      id: "total",
      header: "Deliveries",
      align: "right" as const,
      render: (row: WebhookHealthInstallation) => row.total,
    },
    {
      id: "failureRate",
      header: "Failure rate",
      align: "right" as const,
      render: (row: WebhookHealthInstallation) => formatPercent(row.failureRate),
    },
    {
      id: "unreachable",
      header: "Unreachable",
      align: "right" as const,
      render: (row: WebhookHealthInstallation) => row.unreachableCount,
    },
  ];

  return (
    <Card className="admin-table-card">
      <h2 className="admin-card-title">Per-installation breakdown</h2>
      <DataTable
        columns={columns}
        rows={installations}
        getRowKey={(row) => row.externalInstallationId}
        emptyState="No installation deliveries in this window."
      />
    </Card>
  );
}

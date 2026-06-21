import { useEffect, useState } from "react";

import {
  Button,
  Card,
  DataTable,
  Dialog,
  Input,
  Pagination,
  Select,
} from "@pipewatch/ui";

import { apiFetch, buildQueryString } from "../api/client.js";
import type {
  DeliveryListQuery,
  DeliveryOutcome,
  PaginatedResult,
  WebhookDeliveryItem,
} from "../api/types.js";
import { formatDateTime, truncateId } from "../lib/format.js";
import {
  DeliveryStatusBadge,
  isUnreachableDelivery,
} from "./DeliveryStatusBadge.js";
import { RequireRole } from "./RequireRole.js";

type DeliveryTableProps = {
  initialQuery?: DeliveryListQuery;
};

const PAGE_SIZE = 25;

export function DeliveryTable({ initialQuery = {} }: DeliveryTableProps) {
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState(initialQuery.event ?? "");
  const [installationFilter, setInstallationFilter] = useState(
    initialQuery.installation_id ?? "",
  );
  const [outcomeFilter, setOutcomeFilter] = useState<DeliveryOutcome | "">(
    initialQuery.outcome ??
      (initialQuery.unreachable ? "unreachable" : ""),
  );
  const [rows, setRows] = useState<WebhookDeliveryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingRedelivery, setPendingRedelivery] =
    useState<WebhookDeliveryItem | null>(null);
  const [redelivering, setRedelivering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDeliveries = async () => {
      setLoading(true);
      setError(null);

      try {
        const query = buildQueryString({
          page,
          page_size: PAGE_SIZE,
          event: eventFilter || undefined,
          installation_id: installationFilter || undefined,
          outcome: outcomeFilter || undefined,
          workspace_id: initialQuery.workspace_id,
        });

        const result = await apiFetch<PaginatedResult<WebhookDeliveryItem>>(
          `/api/webhook-deliveries${query}`,
        );

        if (!cancelled) {
          setRows(result.items);
          setTotal(result.total);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load deliveries",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDeliveries();

    return () => {
      cancelled = true;
    };
  }, [
    page,
    eventFilter,
    installationFilter,
    outcomeFilter,
    reloadToken,
    initialQuery.workspace_id,
  ]);

  const columns = [
    {
      id: "deliveredAt",
      header: "Delivered",
      sortable: true,
      render: (row: WebhookDeliveryItem) => formatDateTime(row.deliveredAt),
    },
    {
      id: "event",
      header: "Event",
      render: (row: WebhookDeliveryItem) =>
        row.action ? `${row.event}.${row.action}` : row.event,
    },
    {
      id: "status",
      header: "Status",
      render: (row: WebhookDeliveryItem) => (
        <DeliveryStatusBadge outcome={row.outcome} statusCode={row.statusCode} />
      ),
    },
    {
      id: "installation",
      header: "Installation",
      mono: true,
      render: (row: WebhookDeliveryItem) =>
        row.externalInstallationId
          ? truncateId(row.externalInstallationId, 10)
          : "—",
    },
    {
      id: "workspace",
      header: "Workspace",
      mono: true,
      render: (row: WebhookDeliveryItem) =>
        row.workspaceId ? truncateId(row.workspaceId, 10) : "—",
    },
    {
      id: "actions",
      header: "",
      align: "right" as const,
      render: (row: WebhookDeliveryItem) => (
        <RequireRole minimum="operator">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPendingRedelivery(row)}
          >
            Redeliver
          </Button>
        </RequireRole>
      ),
    },
  ];

  const confirmRedelivery = async () => {
    if (!pendingRedelivery) {
      return;
    }

    setRedelivering(true);
    try {
      await apiFetch(`/api/webhook-deliveries/${pendingRedelivery.id}/redeliver`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      setPendingRedelivery(null);
      setReloadToken((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Redelivery failed");
    } finally {
      setRedelivering(false);
    }
  };

  return (
    <Card className="admin-table-card">
      <div className="admin-filter-row">
        <Input
          label="Event"
          value={eventFilter}
          onChange={(event) => {
            setPage(1);
            setEventFilter(event.target.value);
          }}
          placeholder="workflow_run"
        />
        <Input
          label="Installation ID"
          value={installationFilter}
          onChange={(event) => {
            setPage(1);
            setInstallationFilter(event.target.value);
          }}
          placeholder="12345678"
        />
        <Select
          label="Outcome"
          value={outcomeFilter || "all"}
          onChange={(value) => {
            setPage(1);
            setOutcomeFilter(value === "all" ? "" : (value as DeliveryOutcome));
          }}
          options={[
            { value: "all", label: "All deliveries" },
            { value: "success", label: "Success" },
            { value: "http_failure", label: "HTTP failure" },
            { value: "unreachable", label: "Unreachable" },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="admin-inline-error" role="alert">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="admin-muted">Loading deliveries…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          emptyState="No webhook deliveries match the current filters."
          className="admin-delivery-table"
        />
      )}

      <Pagination
        page={page}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        labels={{
          summary: `${String(total)} deliveries`,
          prev: "Previous",
          next: "Next",
          previousPageAriaLabel: "Previous page",
          nextPageAriaLabel: "Next page",
          pagesAriaLabel: "Delivery pages",
          pageAriaLabel: (value) => `Page ${String(value)}`,
        }}
      />

      <Dialog
        open={pendingRedelivery !== null}
        onClose={() => setPendingRedelivery(null)}
        title="Confirm redelivery"
        description="GitHub will attempt to deliver this webhook again. This action is audited."
        closeAriaLabel="Close redelivery dialog"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRedelivery(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={redelivering}
              onClick={() => void confirmRedelivery()}
            >
              Redeliver
            </Button>
          </>
        }
      >
        {pendingRedelivery ? (
          <p>
            Redeliver <strong>{pendingRedelivery.event}</strong> delivery{" "}
            <code>{pendingRedelivery.githubDeliveryId}</code>?
          </p>
        ) : null}
      </Dialog>
    </Card>
  );
}

export function deliveryRowClassName(statusCode: number): string {
  return isUnreachableDelivery(statusCode) ? "admin-row-unreachable" : "";
}

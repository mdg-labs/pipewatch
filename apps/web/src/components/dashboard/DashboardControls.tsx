"use client";

import type { IntegrationSummary } from "@pipewatch/types";
import {
  FilterBar,
  FilterChip,
  Select,
  classNames,
} from "@pipewatch/ui";
import { LayoutGrid, List } from "lucide-react";

import type {
  DashboardSortKey,
  DashboardStatusFilter,
  DashboardViewMode,
} from "@/lib/dashboard-types";

import "./dashboard.css";

const SORT_OPTIONS: { value: DashboardSortKey; label: string }[] = [
  { value: "last_run", label: "Last run" },
  { value: "name", label: "Name" },
  { value: "failure_rate", label: "Failure rate" },
];

const STATUS_FILTERS: { value: DashboardStatusFilter; label: string; tone: "default" | "failure" | "running" | "success" }[] = [
  { value: "all", label: "All", tone: "default" },
  { value: "failing", label: "Failing", tone: "failure" },
  { value: "running", label: "Running", tone: "running" },
  { value: "healthy", label: "Healthy", tone: "success" },
];

export type DashboardControlsProps = {
  sortKey: DashboardSortKey;
  onSortChange: (sortKey: DashboardSortKey) => void;
  statusFilter: DashboardStatusFilter;
  onStatusFilterChange: (filter: DashboardStatusFilter) => void;
  integrationId: string | null;
  onIntegrationChange: (integrationId: string | null) => void;
  integrations: IntegrationSummary[];
  viewMode: DashboardViewMode;
  onViewModeChange: (mode: DashboardViewMode) => void;
  resultsLabel: string;
};

export function DashboardControls({
  sortKey,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  integrationId,
  onIntegrationChange,
  integrations,
  viewMode,
  onViewModeChange,
  resultsLabel,
}: DashboardControlsProps) {
  const showIntegrationFilter = integrations.length > 1;

  return (
    <div className="pw-dashboard-controls">
      <FilterBar className="pw-dashboard-controls-row">
        <Select
          label="Sort"
          size="sm"
          value={sortKey}
          options={SORT_OPTIONS}
          onChange={(value) => onSortChange(value as DashboardSortKey)}
          className="pw-dashboard-sort"
        />

        <div className="pw-dashboard-filter-chips" role="group" aria-label="Status filters">
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              tone={filter.tone}
              active={statusFilter === filter.value}
              onClick={() => onStatusFilterChange(filter.value)}
            />
          ))}
        </div>

        {showIntegrationFilter ? (
          <Select
            label="Integration"
            size="sm"
            value={integrationId ?? "all"}
            options={[
              { value: "all", label: "All orgs" },
              ...integrations.map((integration) => ({
                value: integration.id,
                label: integration.account_login,
              })),
            ]}
            onChange={(value) =>
              onIntegrationChange(value === "all" ? null : value)
            }
            className="pw-dashboard-integration-filter"
            mono
          />
        ) : null}

        <div className="pw-dashboard-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={classNames(
              "pw-dashboard-view-toggle-btn",
              viewMode === "cards" && "pw-dashboard-view-toggle-btn-active",
            )}
            aria-pressed={viewMode === "cards"}
            aria-label="Card view"
            onClick={() => onViewModeChange("cards")}
          >
            <LayoutGrid size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={classNames(
              "pw-dashboard-view-toggle-btn",
              viewMode === "table" && "pw-dashboard-view-toggle-btn-active",
            )}
            aria-pressed={viewMode === "table"}
            aria-label="Table view"
            onClick={() => onViewModeChange("table")}
          >
            <List size={14} aria-hidden />
          </button>
        </div>
      </FilterBar>

      <p className="pw-dashboard-results-label">{resultsLabel}</p>
    </div>
  );
}

"use client";

import type { IntegrationSummary } from "@pipewatch/types";
import {
  FilterBar,
  FilterChip,
  Select,
  classNames,
} from "@pipewatch/ui";
import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type {
  DashboardSortKey,
  DashboardStatusFilter,
  DashboardViewMode,
} from "@/lib/dashboard-types";

import "./dashboard.css";

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
  const t = useTranslations("dashboard.controls");
  const showIntegrationFilter = integrations.length > 1;

  const sortOptions = useMemo(
    () => [
      { value: "last_run" as const, label: t("sortLastRun") },
      { value: "name" as const, label: t("sortName") },
      { value: "failure_rate" as const, label: t("sortFailureRate") },
    ],
    [t],
  );

  const statusFilters = useMemo(
    () => [
      { value: "all" as const, label: t("filterAll"), tone: "default" as const },
      { value: "failing" as const, label: t("filterFailing"), tone: "failure" as const },
      { value: "running" as const, label: t("filterRunning"), tone: "running" as const },
      { value: "healthy" as const, label: t("filterHealthy"), tone: "success" as const },
    ],
    [t],
  );

  return (
    <div className="pw-dashboard-controls">
      <FilterBar className="pw-dashboard-controls-row">
        <Select
          label={t("sort")}
          size="sm"
          value={sortKey}
          options={sortOptions}
          onChange={(value) => onSortChange(value as DashboardSortKey)}
          className="pw-dashboard-sort"
        />

        <div className="pw-dashboard-filter-chips" role="group" aria-label={t("statusFiltersAriaLabel")}>
          {statusFilters.map((filter) => (
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
            label={t("integration")}
            size="sm"
            value={integrationId ?? "all"}
            options={[
              { value: "all", label: t("allOrgs") },
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

        <div className="pw-dashboard-view-toggle" role="group" aria-label={t("viewModeAriaLabel")}>
          <button
            type="button"
            className={classNames(
              "pw-dashboard-view-toggle-btn",
              viewMode === "cards" && "pw-dashboard-view-toggle-btn-active",
            )}
            aria-pressed={viewMode === "cards"}
            aria-label={t("cardViewAriaLabel")}
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
            aria-label={t("tableViewAriaLabel")}
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

"use client";

import {
  FilterBar,
  FilterChip,
  Select,
} from "@pipewatch/ui";

import type { RunDateRange, RunListFilters, RunStatusFilter } from "@/lib/run-filters";
import { formatTriggerLabel } from "@/lib/run-utils";

import "../repos/repo-detail.css";

const STATUS_FILTERS: {
  value: RunStatusFilter;
  label: string;
  tone: "default" | "success" | "failure" | "running" | "cancelled";
}[] = [
  { value: "all", label: "All", tone: "default" },
  { value: "running", label: "Running", tone: "running" },
  { value: "succeeded", label: "Succeeded", tone: "success" },
  { value: "failed", label: "Failed", tone: "failure" },
  { value: "cancelled", label: "Cancelled", tone: "cancelled" },
];

const DATE_RANGE_OPTIONS: { value: RunDateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export type RunFiltersProps = {
  filters: RunListFilters;
  branches: string[];
  triggers: string[];
  onFiltersChange: (patch: Partial<RunListFilters>) => void;
};

export function RunFilters({
  filters,
  branches,
  triggers,
  onFiltersChange,
}: RunFiltersProps) {
  return (
    <div className="pw-run-filters">
      <FilterBar className="pw-run-filters-row">
        <Select
          label="Branch"
          size="sm"
          value={filters.branch ?? "all"}
          options={[
            { value: "all", label: "All branches" },
            ...branches.map((branch) => ({ value: branch, label: branch })),
          ]}
          onChange={(value) =>
            onFiltersChange({ branch: value === "all" ? undefined : value })
          }
          className="pw-run-filter-branch"
          mono
        />

        <div className="pw-run-filters-chips" role="group" aria-label="Status filters">
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              tone={filter.tone}
              active={filters.status === filter.value}
              onClick={() => onFiltersChange({ status: filter.value })}
            />
          ))}
        </div>

        <Select
          label="Trigger"
          size="sm"
          value={filters.trigger ?? "all"}
          options={[
            { value: "all", label: "All triggers" },
            ...triggers.map((trigger) => ({
              value: trigger,
              label: formatTriggerLabel(trigger),
            })),
          ]}
          onChange={(value) =>
            onFiltersChange({ trigger: value === "all" ? undefined : value })
          }
          className="pw-run-filter-trigger"
        />

        <Select
          label="Date range"
          size="sm"
          value={filters.range}
          options={DATE_RANGE_OPTIONS}
          onChange={(value) => onFiltersChange({ range: value as RunDateRange })}
          className="pw-run-filter-range"
        />
      </FilterBar>
    </div>
  );
}

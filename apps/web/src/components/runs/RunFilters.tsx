"use client";

import {
  FilterBar,
  FilterChip,
  Select,
} from "@pipewatch/ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { formatTriggerLabel } from "@/i18n/trigger-labels";
import type { RunDateRange, RunListFilters, RunStatusFilter } from "@/lib/run-filters";

import "../repos/repo-detail.css";

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
  const t = useTranslations("runs.filters");
  const tTriggers = useTranslations("runs.triggers");

  const statusFilters = useMemo(
    () => [
      { value: "all" as const, label: t("all"), tone: "default" as const },
      { value: "running" as const, label: t("running"), tone: "running" as const },
      { value: "succeeded" as const, label: t("succeeded"), tone: "success" as const },
      { value: "failed" as const, label: t("failed"), tone: "failure" as const },
      { value: "cancelled" as const, label: t("cancelled"), tone: "cancelled" as const },
    ],
    [t],
  );

  const dateRangeOptions = useMemo(
    () => [
      { value: "7d" as const, label: t("last7Days") },
      { value: "30d" as const, label: t("last30Days") },
      { value: "90d" as const, label: t("last90Days") },
      { value: "all" as const, label: t("allTime") },
    ],
    [t],
  );

  return (
    <div className="pw-run-filters">
      <FilterBar className="pw-run-filters-row">
        <Select
          label={t("branch")}
          size="sm"
          value={filters.branch ?? "all"}
          options={[
            { value: "all", label: t("allBranches") },
            ...branches.map((branch) => ({ value: branch, label: branch })),
          ]}
          onChange={(value) =>
            onFiltersChange({ branch: value === "all" ? undefined : value })
          }
          className="pw-run-filter-branch"
          mono
        />

        <div className="pw-run-filters-chips" role="group" aria-label={t("statusFiltersAriaLabel")}>
          {statusFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              tone={filter.tone}
              active={filters.status === filter.value}
              onClick={() => onFiltersChange({ status: filter.value as RunStatusFilter })}
            />
          ))}
        </div>

        <Select
          label={t("trigger")}
          size="sm"
          value={filters.trigger ?? "all"}
          options={[
            { value: "all", label: t("allTriggers") },
            ...triggers.map((trigger) => ({
              value: trigger,
              label: formatTriggerLabel(trigger, tTriggers),
            })),
          ]}
          onChange={(value) =>
            onFiltersChange({ trigger: value === "all" ? undefined : value })
          }
          className="pw-run-filter-trigger"
        />

        <Select
          label={t("dateRange")}
          size="sm"
          value={filters.range}
          options={dateRangeOptions}
          onChange={(value) => onFiltersChange({ range: value as RunDateRange })}
          className="pw-run-filter-range"
        />
      </FilterBar>
    </div>
  );
}

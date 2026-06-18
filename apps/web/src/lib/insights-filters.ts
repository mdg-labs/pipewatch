import type { InsightsRange } from "@pipewatch/types";
import {
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  type FilterFieldConfig,
  type FilterState,
} from "@pipewatch/ui";

export const INSIGHTS_FILTER_FIELDS: FilterFieldConfig[] = [
  { key: "range", defaultValue: "7d" },
  { key: "repoId" },
  { key: "workflow" },
];

export type InsightsFilters = {
  range: InsightsRange;
  repoId: string | undefined;
  workflow: string | undefined;
};

export function parseInsightsFilters(searchParams: URLSearchParams): InsightsFilters {
  const state = parseFiltersFromSearchParams(searchParams, INSIGHTS_FILTER_FIELDS);
  const range = state.range === "30d" ? "30d" : "7d";

  return {
    range,
    repoId:
      typeof state.repoId === "string" && state.repoId.length > 0 ? state.repoId : undefined,
    workflow:
      typeof state.workflow === "string" && state.workflow.length > 0
        ? state.workflow
        : undefined,
  };
}

export function insightsFiltersToSearchParams(filters: InsightsFilters): URLSearchParams {
  const state: FilterState = {
    range: filters.range,
  };

  if (filters.repoId) {
    state.repoId = filters.repoId;
  }

  if (filters.workflow) {
    state.workflow = filters.workflow;
  }

  return filtersToSearchParams(state, INSIGHTS_FILTER_FIELDS);
}

export function insightsFiltersQueryString(filters: InsightsFilters): string {
  const params = insightsFiltersToSearchParams(filters);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

export function insightsApiQueryString(filters: InsightsFilters): string {
  const params = new URLSearchParams({ range: filters.range });

  if (filters.repoId) {
    params.set("repoId", filters.repoId);
  }

  if (filters.workflow) {
    params.set("workflow", filters.workflow);
  }

  return params.toString();
}

export function withUpdatedInsightsFilters(
  current: InsightsFilters,
  patch: Partial<InsightsFilters>,
): InsightsFilters {
  const next: InsightsFilters = { ...current, ...patch };

  if (patch.repoId !== undefined && patch.repoId !== current.repoId) {
    next.workflow = undefined;
  }

  return next;
}

export function buildInsightsPath(workspaceSlug: string, filters: InsightsFilters): string {
  return `/workspaces/${workspaceSlug}/insights${insightsFiltersQueryString(filters)}`;
}

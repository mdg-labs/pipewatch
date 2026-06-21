import type { InsightsRange } from "@pipewatch/types";
import {
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  type FilterFieldConfig,
  type FilterState,
} from "@pipewatch/ui";

import { insightsApiQueryString } from "@/lib/insights-filters";

export const RECENT_RUNS_PAGE_SIZE = 10;

export const REPO_OVERVIEW_FILTER_FIELDS: FilterFieldConfig[] = [{ key: "range", defaultValue: "7d" }];

export type RepoOverviewFilters = {
  range: InsightsRange;
};

export function parseRepoOverviewFilters(searchParams: URLSearchParams): RepoOverviewFilters {
  const state = parseFiltersFromSearchParams(searchParams, REPO_OVERVIEW_FILTER_FIELDS);
  const range = state.range === "30d" ? "30d" : "7d";

  return { range };
}

export function repoOverviewFiltersToSearchParams(filters: RepoOverviewFilters): URLSearchParams {
  const state: FilterState = { range: filters.range };
  return filtersToSearchParams(state, REPO_OVERVIEW_FILTER_FIELDS);
}

export function repoOverviewFiltersQueryString(filters: RepoOverviewFilters): string {
  const params = repoOverviewFiltersToSearchParams(filters);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

export function buildRepoOverviewPath(
  workspaceSlug: string,
  repoId: string,
  filters: RepoOverviewFilters,
): string {
  return `/workspaces/${workspaceSlug}/repos/${repoId}${repoOverviewFiltersQueryString(filters)}`;
}

export function repoOverviewInsightsApiQueryString(
  repoId: string,
  filters: RepoOverviewFilters,
): string {
  return insightsApiQueryString({
    range: filters.range,
    repoId,
    workflow: undefined,
  });
}

export function buildViewAllRunsHref(workspaceSlug: string, repoId: string): string {
  return `/workspaces/${workspaceSlug}/repos/${repoId}/runs`;
}

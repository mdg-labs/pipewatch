import type { ListPipelineRunsQuery, PipelineRun } from "@pipewatch/types";
import {
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  type FilterFieldConfig,
  type FilterState,
} from "@pipewatch/ui";

export const RUN_PAGE_SIZE = 20;

export type RunStatusFilter = "all" | "running" | "succeeded" | "failed" | "cancelled";

export type RunDateRange = "7d" | "30d" | "90d" | "all";

export const RUN_FILTER_FIELDS: FilterFieldConfig[] = [
  { key: "branch" },
  { key: "workflow" },
  { key: "status", defaultValue: "all" },
  { key: "trigger" },
  { key: "range", defaultValue: "30d" },
  { key: "page", defaultValue: "1" },
  { key: "cursor" },
];

export type RunListFilters = {
  branch: string | undefined;
  workflow: string | undefined;
  status: RunStatusFilter;
  trigger: string | undefined;
  range: RunDateRange;
  page: number;
  cursor: string | undefined;
};

export type RunsListResponse = {
  data: PipelineRun[];
  cursor: string | null;
  has_more: boolean;
};

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseRunFilters(searchParams: URLSearchParams): RunListFilters {
  const state = parseFiltersFromSearchParams(searchParams, RUN_FILTER_FIELDS);
  const status = (state.status as RunStatusFilter | undefined) ?? "all";
  const range = (state.range as RunDateRange | undefined) ?? "30d";

  return {
    branch: typeof state.branch === "string" && state.branch.length > 0 ? state.branch : undefined,
    workflow:
      typeof state.workflow === "string" && state.workflow.length > 0
        ? state.workflow
        : undefined,
    status:
      status === "running" ||
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled"
        ? status
        : "all",
    trigger:
      typeof state.trigger === "string" && state.trigger.length > 0 ? state.trigger : undefined,
    range: range === "7d" || range === "90d" || range === "all" ? range : "30d",
    page: parsePage(typeof state.page === "string" ? state.page : undefined),
    cursor:
      typeof state.cursor === "string" && state.cursor.length > 0 ? state.cursor : undefined,
  };
}

export function runFiltersToSearchParams(filters: RunListFilters): URLSearchParams {
  const state: FilterState = {
    status: filters.status,
    range: filters.range,
    page: String(filters.page),
  };

  if (filters.branch) {
    state.branch = filters.branch;
  }

  if (filters.workflow) {
    state.workflow = filters.workflow;
  }

  if (filters.trigger) {
    state.trigger = filters.trigger;
  }

  if (filters.page > 1 && filters.cursor) {
    state.cursor = filters.cursor;
  }

  return filtersToSearchParams(state, RUN_FILTER_FIELDS);
}

export function runFiltersQueryString(filters: RunListFilters): string {
  const params = runFiltersToSearchParams(filters);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

/** Shareable repo runs list URL (Page Inventory B4-runs). */
export function buildRepoRunsPath(
  workspaceSlug: string,
  repoId: string,
  filters: RunListFilters,
): string {
  return `/workspaces/${workspaceSlug}/repos/${repoId}/runs${runFiltersQueryString(filters)}`;
}

function resolveStartedFrom(range: RunDateRange): string | undefined {
  if (range === "all") {
    return undefined;
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);
  from.setUTCHours(0, 0, 0, 0);
  return from.toISOString();
}

/** Map URL filters to pipeline runs API query (PRD §7, #65). */
export function toRunsApiQuery(filters: RunListFilters): ListPipelineRunsQuery & {
  page_size: number;
  cursor?: string;
} {
  const query: ListPipelineRunsQuery & { page_size: number; cursor?: string } = {
    page_size: RUN_PAGE_SIZE,
  };

  if (filters.branch) {
    query.branch = filters.branch;
  }

  if (filters.workflow) {
    query.workflow = filters.workflow;
  }

  if (filters.trigger) {
    query.trigger = filters.trigger;
  }

  const startedFrom = resolveStartedFrom(filters.range);
  if (startedFrom) {
    query.started_from = startedFrom;
  }

  if (filters.status === "running") {
    query.status = "in_progress";
  }

  if (filters.page > 1 && filters.cursor) {
    query.cursor = filters.cursor;
  }

  return query;
}

export function runsApiQueryString(filters: RunListFilters): string {
  const query = toRunsApiQuery(filters);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  return params.toString();
}

export function matchesConclusionFilter(
  run: PipelineRun,
  status: RunStatusFilter,
): boolean {
  if (status === "all" || status === "running") {
    return true;
  }

  if (run.status !== "completed") {
    return false;
  }

  switch (status) {
    case "succeeded":
      return run.conclusion === "success" || run.conclusion === "skipped";
    case "failed":
      return run.conclusion === "failure";
    case "cancelled":
      return run.conclusion === "cancelled";
    default:
      return true;
  }
}

export function applyConclusionFilter(
  runs: PipelineRun[],
  status: RunStatusFilter,
): PipelineRun[] {
  if (status === "all" || status === "running") {
    return runs;
  }

  return runs.filter((run) => matchesConclusionFilter(run, status));
}

export function withUpdatedRunFilters(
  current: RunListFilters,
  patch: Partial<RunListFilters>,
): RunListFilters {
  const next: RunListFilters = { ...current, ...patch };

  if (
    patch.branch !== undefined ||
    patch.workflow !== undefined ||
    patch.status !== undefined ||
    patch.trigger !== undefined ||
    patch.range !== undefined
  ) {
    next.page = 1;
    next.cursor = undefined;
  }

  if (patch.page !== undefined && patch.page <= 1) {
    next.cursor = undefined;
  }

  return next;
}

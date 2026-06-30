"use client";

import type { PipelineRun, RepositorySummary, SseDataEvent } from "@pipewatch/types";
import { EmptyState, Pagination } from "@pipewatch/ui";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ErrorRetry } from "@/components/ErrorRetry";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ActiveRunBanner } from "@/components/repos/ActiveRunBanner";
import { RepoHeader } from "@/components/repos/RepoHeader";
import { WorkflowTabs } from "@/components/repos/WorkflowTabs";
import { RunFilters } from "@/components/runs/RunFilters";
import { RunListTable } from "@/components/runs/RunListTable";
import { useSetLiveStreamOverride, useLiveStreamOverrideClaim } from "@/contexts/live-stream-override-context";
import { useApi } from "@/hooks/use-api";
import {
  buildPaginationLabels,
  formatPaginationSummary,
} from "@/i18n/pagination-labels";
import { useRepoStream } from "@/hooks/use-repo-stream";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import { ApiClientError } from "@/lib/api-client";
import {
  RUN_PAGE_SIZE,
  applyConclusionFilter,
  buildRepoRunsPath,
  parseRunFilters,
  runsApiQueryString,
  type RunListFilters,
  type RunsListResponse,
  withUpdatedRunFilters,
} from "@/lib/run-filters";
import {
  applySseEventToRuns,
  collectWorkflowNames,
  estimateRunTotalItems,
} from "@/lib/run-utils";
import { useToast } from "@/providers/ToastProvider";

import "./repo-detail.css";

export type RepoRunsListViewProps = {
  workspaceSlug: string;
  repoId: string;
};

function collectDistinctValues(runs: PipelineRun[], key: "branch" | "trigger_type"): string[] {
  const values = new Set<string>();

  for (const run of runs) {
    const value = run[key];
    if (value) {
      values.add(value);
    }
  }

  return [...values].sort((left, right) => left.localeCompare(right));
}

export function RepoRunsListView({ workspaceSlug, repoId }: RepoRunsListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspace, workspaceId, workspaceStatus } = useApi();
  const { canMutate } = useWorkspaceRole();
  const { toast } = useToast();
  const setLiveStreamOverride = useSetLiveStreamOverride();
  const { claimOverride, releaseOverride } = useLiveStreamOverrideClaim();
  const t = useTranslations("repos");
  const tPagination = useTranslations("ui.pagination");

  const filters = useMemo(
    () => parseRunFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [repository, setRepository] = useState<RepositorySummary | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const cursorByPageRef = useRef<Map<number, string | null>>(new Map([[1, null]]));

  const updateFilters = useCallback(
    (patch: Partial<RunListFilters>) => {
      const next = withUpdatedRunFilters(filters, patch);
      router.replace(buildRepoRunsPath(workspaceSlug, repoId, next));
    },
    [filters, repoId, router, workspaceSlug],
  );

  const loadData = useCallback(async () => {
    if (!workspace) {
      if (workspaceStatus === "unresolved") {
        setLoading(false);
        setLoadError(true);
      }
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const [repoData, runsResponse] = await Promise.all([
        workspace.get<RepositorySummary>(`/repositories/${repoId}`),
        workspace.get<RunsListResponse>(`/repositories/${repoId}/runs?${runsApiQueryString(filters)}`),
      ]);

      setRepository(repoData);
      const filteredRuns = applyConclusionFilter(runsResponse.data, filters.status);
      setRuns(filteredRuns);
      setHasMore(runsResponse.has_more);

      const pageCursors = cursorByPageRef.current;
      pageCursors.set(filters.page, filters.cursor ?? null);
      if (runsResponse.cursor) {
        pageCursors.set(filters.page + 1, runsResponse.cursor);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspaceStatus, repoId, filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    cursorByPageRef.current = new Map([[1, null]]);
  }, [
    filters.branch,
    filters.workflow,
    filters.status,
    filters.trigger,
    filters.range,
  ]);

  const handleSseEvent = useCallback(
    (event: SseDataEvent) => {
      if (!workspaceId) {
        return;
      }

      setRuns((current) =>
        applySseEventToRuns(current, event, { repoId, workspaceId }),
      );
    },
    [repoId, workspaceId],
  );

  const { status: liveStatus } = useRepoStream({
    repoId,
    onEvent: handleSseEvent,
  });

  useLayoutEffect(() => {
    claimOverride();
    return () => {
      releaseOverride();
    };
  }, [claimOverride, releaseOverride]);

  useEffect(() => {
    setLiveStreamOverride(liveStatus);
    return () => {
      setLiveStreamOverride(null);
    };
  }, [liveStatus, setLiveStreamOverride]);

  const workflows = useMemo(() => collectWorkflowNames(runs), [runs]);
  const branches = useMemo(() => collectDistinctValues(runs, "branch"), [runs]);
  const triggerOptions = useMemo(
    () => collectDistinctValues(runs, "trigger_type"),
    [runs],
  );

  const totalItems = estimateRunTotalItems(filters.page, RUN_PAGE_SIZE, runs.length, hasMore);
  const paginationLabels = useMemo(
    () =>
      buildPaginationLabels({
        summary: formatPaginationSummary({
          page: filters.page,
          pageSize: RUN_PAGE_SIZE,
          totalItems,
          noResults: tPagination("noResults"),
          showing: ({ start, end, total }) =>
            tPagination("showing", { start, end, total }),
        }),
        prev: tPagination("prev"),
        next: tPagination("next"),
        previousPageAriaLabel: tPagination("previousPageAriaLabel"),
        nextPageAriaLabel: tPagination("nextPageAriaLabel"),
        pagesAriaLabel: tPagination("pagesAriaLabel"),
        pageAriaLabel: (page) => tPagination("pageAriaLabel", { page }),
      }),
    [filters.page, tPagination, totalItems],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const cursor = cursorByPageRef.current.get(page) ?? undefined;
      updateFilters({
        page,
        cursor: page > 1 ? cursor ?? undefined : undefined,
      });
    },
    [updateFilters],
  );

  const handleResync = useCallback(async () => {
    if (!workspace || !canMutate) {
      return;
    }

    setSyncing(true);

    try {
      await workspace.post(`/repositories/${repoId}/sync`);
      toast({
        title: t("resync.startedTitle"),
        description: t("resync.startedDescription"),
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : t("resync.failedDescription");
      toast({
        title: t("resync.failedTitle"),
        description: message,
        variant: "error",
      });
    } finally {
      setSyncing(false);
    }
  }, [canMutate, repoId, t, toast, workspaceId]);

  if (loading) {
    return (
      <div className="pw-repo-detail" aria-busy="true">
        <TableSkeleton columns={8} rows={8} />
      </div>
    );
  }

  if (loadError || !repository) {
    return (
      <div className="pw-repo-detail">
        <ErrorRetry message={t("loadError")} onRetry={() => void loadData()} />
      </div>
    );
  }

  return (
    <div className="pw-repo-detail">
      <RepoHeader
        repository={repository}
        workspaceSlug={workspaceSlug}
        syncing={syncing}
        onResync={() => void handleResync()}
        canResync={canMutate}
      />

      <ActiveRunBanner runs={runs} workspaceSlug={workspaceSlug} repoId={repoId} />

      <WorkflowTabs
        workflows={workflows}
        activeWorkflow={filters.workflow}
        onWorkflowChange={(workflow) => updateFilters({ workflow })}
      />

      <RunFilters
        filters={filters}
        branches={branches}
        triggers={triggerOptions}
        onFiltersChange={updateFilters}
      />

      {runs.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <>
          <RunListTable runs={runs} workspaceSlug={workspaceSlug} repoId={repoId} />
          <div className="pw-run-list-footer">
            <Pagination
              page={filters.page}
              totalItems={totalItems}
              pageSize={RUN_PAGE_SIZE}
              onPageChange={handlePageChange}
              labels={paginationLabels}
            />
          </div>
        </>
      )}
    </div>
  );
}

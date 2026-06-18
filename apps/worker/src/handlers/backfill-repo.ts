import type { Job } from "bullmq";

import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import {
  BACKFILL_REPO_JOB_NAME,
  type BackfillRepoJobPayload,
} from "../queues/backfill.js";
import {
  type BackfillTimeWindow,
  GITHUB_RUNS_MAX_PAGES,
  bisectBackfillWindow,
  buildInitialBackfillWindow,
  canSubdivideBackfillWindow,
  collectWorkflowRunExternalIds,
  fetchWorkflowRunsPage,
  formatCreatedRangeFilter,
  gitHubAppConfigFromWorkerEnv,
  ingestWorkflowRuns,
  isWindowAtSearchCap,
  loadIntegrationRecord,
  loadRepositoryRecord,
  loadWorkspaceRetentionContext,
  logBackfillHistoryTruncated,
  markRepositorySynced,
  resolveEffectiveRetentionDays,
  retentionWindowStart,
} from "../services/github/backfill.js";
import { reconcileDeletedPipelineRuns } from "../services/pipeline-upsert.js";

export { BACKFILL_REPO_JOB_NAME };

type BackfillRepoCursor = BackfillRepoJobPayload & {
  runsPage?: number;
  windowStart?: string;
  windowEnd?: string;
  pendingWindows?: BackfillTimeWindow[];
  historyTruncated?: boolean;
};

export type BackfillRepoDeps = {
  db: Db;
  env: WorkerEnv;
  fetchImpl?: typeof fetch;
};

export type BackfillRepoResult = {
  runsIngested: number;
  runsDeleted: number;
  historyTruncated: boolean;
};

function formatWindowFilter(window: BackfillTimeWindow): string {
  return formatCreatedRangeFilter(new Date(window.start), new Date(window.end));
}

/** Paginated workflow run history fetch for one repo — respects retention and updates last_synced_at (PRD §18). */
export async function backfillRepo(
  job: Job<BackfillRepoCursor>,
  deps: BackfillRepoDeps,
): Promise<BackfillRepoResult> {
  const { repoId, workspaceId, integrationId } = job.data;
  const startPage = job.data.runsPage ?? 1;

  const repository = await loadRepositoryRecord(deps.db, repoId, workspaceId);
  if (!repository.enabled) {
    return { runsIngested: 0, runsDeleted: 0, historyTruncated: false };
  }

  const integration = await loadIntegrationRecord(deps.db, integrationId, workspaceId);
  const workspace = await loadWorkspaceRetentionContext(deps.db, workspaceId);
  const retentionDays = resolveEffectiveRetentionDays(
    repository.retentionDays,
    workspace.defaultRetentionDays,
    workspace.plan,
    deps.env.RETENTION_DAYS,
  );

  const config = gitHubAppConfigFromWorkerEnv(deps.env);
  const fetchDeps = {
    database: deps.db,
    config,
    integration,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  };

  let currentWindow: BackfillTimeWindow | null;
  const pendingWindows: BackfillTimeWindow[] = [...(job.data.pendingWindows ?? [])];

  if (job.data.windowStart && job.data.windowEnd) {
    currentWindow = { start: job.data.windowStart, end: job.data.windowEnd };
  } else if (pendingWindows.length > 0) {
    currentWindow = pendingWindows.shift() ?? null;
  } else {
    currentWindow = buildInitialBackfillWindow(retentionDays);
  }
  let page = startPage;
  let runsIngested = 0;
  let historyTruncated = job.data.historyTruncated ?? false;

  while (currentWindow) {
    const createdFilter = formatWindowFilter(currentWindow);
    const response = await fetchWorkflowRunsPage(
      repository.fullName,
      page,
      createdFilter,
      fetchDeps,
    );

    if (
      page === 1 &&
      isWindowAtSearchCap(response.total_count) &&
      canSubdivideBackfillWindow(currentWindow)
    ) {
      const [left, right] = bisectBackfillWindow(currentWindow);
      pendingWindows.unshift(right, left);
      currentWindow = pendingWindows.shift() ?? null;
      page = 1;
      await job.updateData({
        repoId,
        workspaceId,
        integrationId,
        pendingWindows,
        ...(currentWindow
          ? { windowStart: currentWindow.start, windowEnd: currentWindow.end }
          : {}),
        historyTruncated,
      });
      continue;
    }

    if (page === 1 && isWindowAtSearchCap(response.total_count)) {
      historyTruncated = true;
      logBackfillHistoryTruncated(
        repository.fullName,
        currentWindow,
        response.total_count,
      );
      await job.log(
        `GitHub search cap (${String(response.total_count)} runs) hit for ${repository.fullName}; ` +
          `window ${currentWindow.start}..${currentWindow.end} may be incomplete`,
      );
    }

    const batch = response.workflow_runs;
    if (batch.length > 0) {
      runsIngested += await ingestWorkflowRuns(deps.db, batch, {
        workspaceId,
        repoId,
        fullName: repository.fullName,
      }, fetchDeps);
    }

    if (batch.length < 100) {
      currentWindow = pendingWindows.shift() ?? null;
      page = 1;
      await job.updateData({
        repoId,
        workspaceId,
        integrationId,
        pendingWindows,
        ...(currentWindow
          ? { windowStart: currentWindow.start, windowEnd: currentWindow.end }
          : {}),
        historyTruncated,
      });
      continue;
    }

    if (page >= GITHUB_RUNS_MAX_PAGES) {
      historyTruncated = true;
      logBackfillHistoryTruncated(
        repository.fullName,
        currentWindow,
        response.total_count,
      );
      await job.log(
        `GitHub search cap reached at page ${String(page)} for ${repository.fullName}; ` +
          `window ${currentWindow.start}..${currentWindow.end} may be incomplete`,
      );
      currentWindow = pendingWindows.shift() ?? null;
      page = 1;
      await job.updateData({
        repoId,
        workspaceId,
        integrationId,
        pendingWindows,
        ...(currentWindow
          ? { windowStart: currentWindow.start, windowEnd: currentWindow.end }
          : {}),
        historyTruncated,
      });
      continue;
    }

    page += 1;
    await job.updateData({
      repoId,
      workspaceId,
      integrationId,
      runsPage: page,
      windowStart: currentWindow.start,
      windowEnd: currentWindow.end,
      pendingWindows,
      historyTruncated,
    });
  }

  const retentionCutoff = retentionWindowStart(retentionDays);
  const { externalRunIds, complete } = await collectWorkflowRunExternalIds(
    repository.fullName,
    retentionDays,
    fetchDeps,
  );

  let runsDeleted = 0;
  if (complete) {
    runsDeleted = await reconcileDeletedPipelineRuns(deps.db, {
      workspaceId,
      repoId,
      githubExternalRunIds: externalRunIds,
      retentionCutoff,
    });
  }

  await markRepositorySynced(deps.db, repoId, new Date());
  await job.updateData({ repoId, workspaceId, integrationId, historyTruncated });

  return { runsIngested, runsDeleted, historyTruncated };
}

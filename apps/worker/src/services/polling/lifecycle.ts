import type { PipewatchMode } from "@pipewatch/config/env";
import type { Queue } from "bullmq";

import {
  defaultJobOptionsFor,
  getQueue,
  QUEUE_NAMES,
} from "../../queues/index.js";
import {
  POLL_REPO_JOB_NAME,
  pollRepeatableJobId,
  type PollRepoJobPayload,
} from "../../queues/polling.js";

export const DEFAULT_POLLING_INTERVAL_SECONDS = 60;

export type RepositoryPollingState = {
  repoId: string;
  workspaceId: string;
  integrationId: string;
  enabled: boolean;
  pollingIntervalSeconds: number | null;
};

/** Effective per-repo interval — global CE `polling` mode defaults to 60s (PRD §4.4, §18). */
export function resolveEffectivePollingIntervalSeconds(
  pollingIntervalSeconds: number | null,
  pipewatchMode: PipewatchMode,
): number | null {
  if (pollingIntervalSeconds !== null) {
    return pollingIntervalSeconds;
  }

  if (pipewatchMode === "polling") {
    return DEFAULT_POLLING_INTERVAL_SECONDS;
  }

  return null;
}

export function shouldSchedulePolling(
  state: RepositoryPollingState,
  pipewatchMode: PipewatchMode,
): boolean {
  if (!state.enabled) {
    return false;
  }

  return resolveEffectivePollingIntervalSeconds(state.pollingIntervalSeconds, pipewatchMode) !== null;
}

function resolvePollingQueue(redisUrl: string): Queue<PollRepoJobPayload> {
  return getQueue(QUEUE_NAMES.POLLING, redisUrl);
}

/** Remove repeatable poll-repo jobs for a repository (tries each known interval). */
export async function removePollingRepeatable(
  redisUrl: string,
  repoId: string,
  intervalsSeconds: readonly number[] = [],
): Promise<void> {
  const queue = resolvePollingQueue(redisUrl);
  const jobId = pollRepeatableJobId(repoId);
  const uniqueIntervals = [...new Set(intervalsSeconds)];

  await Promise.all(
    uniqueIntervals.map((intervalSeconds) =>
      queue.removeRepeatable(
        POLL_REPO_JOB_NAME,
        { every: intervalSeconds * 1000 },
        jobId,
      ),
    ),
  );
}

function collectPollingIntervals(
  pipewatchMode: PipewatchMode,
  states: readonly (RepositoryPollingState | undefined)[],
): number[] {
  const intervals: number[] = [];

  for (const state of states) {
    if (!state) {
      continue;
    }

    const interval = resolveEffectivePollingIntervalSeconds(
      state.pollingIntervalSeconds,
      pipewatchMode,
    );
    if (interval !== null) {
      intervals.push(interval);
    }
  }

  return intervals;
}

/** Register or refresh the repeatable poll-repo job for a repository. */
export async function addPollingRepeatable(
  redisUrl: string,
  state: RepositoryPollingState,
  pipewatchMode: PipewatchMode,
): Promise<void> {
  const intervalSeconds = resolveEffectivePollingIntervalSeconds(
    state.pollingIntervalSeconds,
    pipewatchMode,
  );

  if (!state.enabled || intervalSeconds === null) {
    return;
  }

  const queue = resolvePollingQueue(redisUrl);
  const payload: PollRepoJobPayload = {
    repoId: state.repoId,
    workspaceId: state.workspaceId,
    integrationId: state.integrationId,
  };

  await queue.add(POLL_REPO_JOB_NAME, payload, {
    jobId: pollRepeatableJobId(state.repoId),
    repeat: { every: intervalSeconds * 1000 },
    ...defaultJobOptionsFor(QUEUE_NAMES.POLLING),
  });
}

/** Idempotent sync — remove existing repeatable, re-add when polling is active. */
export async function syncPollingLifecycle(
  redisUrl: string,
  pipewatchMode: PipewatchMode,
  state: RepositoryPollingState,
  previousState?: RepositoryPollingState,
): Promise<void> {
  const intervals = collectPollingIntervals(pipewatchMode, [state, previousState]);
  await removePollingRepeatable(redisUrl, state.repoId, intervals);

  if (shouldSchedulePolling(state, pipewatchMode)) {
    await addPollingRepeatable(redisUrl, state, pipewatchMode);
  }
}

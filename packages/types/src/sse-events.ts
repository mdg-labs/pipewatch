import type { PipelineJobSummary } from "./pipeline-job.js";
import type { PipelineRunSummary } from "./pipeline-run.js";

/** Redis pub/sub channel prefix — scoped per workspace + repository (PRD §19). */
export const SSE_CHANNEL_PREFIX = "sse:repo:";

/** Heartbeat interval for SSE connections (PRD §19, page B22). */
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

export type SseHeartbeatData = {
  ts: number;
};

export type SseRunCreatedEvent = {
  type: "run:created";
  data: PipelineRunSummary;
};

export type SseRunUpdatedEvent = {
  type: "run:updated";
  data: PipelineRunSummary;
};

export type SseRunCompletedEvent = {
  type: "run:completed";
  data: PipelineRunSummary;
};

export type SseJobUpdatedEvent = {
  type: "job:updated";
  data: PipelineJobSummary;
};

export type SseHeartbeatEvent = {
  type: "heartbeat";
  data: SseHeartbeatData;
};

/** Pipeline SSE payload union (PRD §19). */
export type SseEvent =
  | SseRunCreatedEvent
  | SseRunUpdatedEvent
  | SseRunCompletedEvent
  | SseJobUpdatedEvent
  | SseHeartbeatEvent;

/** Data-bearing SSE events published by the worker (excludes heartbeat). */
export type SseDataEvent = Exclude<SseEvent, SseHeartbeatEvent>;

export type SseEventType = SseDataEvent["type"];

/** Resolve the Redis pub/sub channel for a workspace repository stream. */
export function getSseChannel(workspaceId: string, repoId: string): string {
  return `${SSE_CHANNEL_PREFIX}${workspaceId}:${repoId}`;
}

import type { PipelineJobSummary, PipelineRunSummary } from "@pipewatch/types";

export type SseEventType =
  | "run:created"
  | "run:updated"
  | "run:completed"
  | "job:updated";

export type PublishSseEventInput = {
  workspaceId: string;
  repoId: string;
  type: SseEventType;
  data: PipelineRunSummary | PipelineJobSummary;
};

/** Stub hook for P9 SSE broadcast — no-op until Redis pub/sub lands. */
export async function publishSseEvent(input: PublishSseEventInput): Promise<void> {
  void input;
}

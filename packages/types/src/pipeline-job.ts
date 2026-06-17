import type { PipelineConclusion, PipelineStatus } from "./common.js";

/** Pipeline job API resource — placeholder; Zod schemas added in P2/P3. */
export interface PipelineJob {
  id: string;
  workspaceId: string;
  runId: string;
  externalJobId: string;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  runnerName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

/** SSE summary variant — fields finalized in P2/P3. */
export interface PipelineJobSummary {
  id: string;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  durationMs: number | null;
}

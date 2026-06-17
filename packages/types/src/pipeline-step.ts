import type { PipelineConclusion, PipelineStatus } from "./common.js";

/** Pipeline step API resource — placeholder; Zod schemas added in P2/P3. */
export interface PipelineStep {
  id: string;
  jobId: string;
  number: number;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

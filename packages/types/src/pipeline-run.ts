import type { PipelineConclusion, PipelineStatus } from "./common.js";

/** Pipeline run API resource — placeholder; Zod schemas added in P2/P3. */
export interface PipelineRun {
  id: string;
  workspaceId: string;
  repoId: string;
  externalRunId: string;
  pipelineName: string;
  pipelineDefinitionRef: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  branch: string;
  commitSha: string;
  actorLogin: string;
  triggerType: string;
  sourceUrl: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

/** SSE / list summary variant — fields finalized in P2/P3. */
export interface PipelineRunSummary {
  id: string;
  pipelineName: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  branch: string;
  startedAt: string | null;
  durationMs: number | null;
}

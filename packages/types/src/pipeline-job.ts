import type { PipelineConclusion, PipelineStatus } from "./common.js";

/** Pipeline job API resource (PRD §7 — page B6). */
export type PipelineJob = {
  id: string;
  workspace_id: string;
  run_id: string;
  external_job_id: string;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  runner_name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

/** List response for jobs on a pipeline run. */
export type PipelineJobsList = {
  data: PipelineJob[];
};

/** SSE summary variant — camelCase for worker SSE payloads. */
export interface PipelineJobSummary {
  id: string;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  durationMs: number | null;
}

import type { PipelineConclusion, PipelineStatus } from "./common.js";

/** Pipeline step API resource (PRD §7 — page B6). */
export type PipelineStep = {
  id: string;
  job_id: string;
  number: number;
  name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

/** List response for steps on a pipeline job. */
export type PipelineStepsList = {
  data: PipelineStep[];
};

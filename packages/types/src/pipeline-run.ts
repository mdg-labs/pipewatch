import type { PaginatedResponse, PipelineConclusion, PipelineStatus } from "./common.js";

/** Pipeline run API resource (PRD §7 — pages B4/B6). */
export type PipelineRun = {
  id: string;
  workspace_id: string;
  repo_id: string;
  external_run_id: string;
  pipeline_name: string;
  pipeline_definition_ref: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  branch: string;
  commit_sha: string;
  commit_message: string | null;
  actor_login: string | null;
  trigger_type: string;
  source_url: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
};

/** SSE / list summary variant — camelCase for worker SSE payloads. */
export interface PipelineRunSummary {
  id: string;
  pipelineName: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  branch: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

/** Query filters for `GET /api/v1/workspaces/:workspaceId/repositories/:repoId/runs`. */
export type ListPipelineRunsQuery = {
  branch?: string | undefined;
  workflow?: string | undefined;
  status?: PipelineStatus | undefined;
  trigger?: string | undefined;
  started_from?: string | undefined;
  started_to?: string | undefined;
  page_size?: number | undefined;
  cursor?: string | undefined;
};

export type PaginatedPipelineRuns = PaginatedResponse<PipelineRun>;

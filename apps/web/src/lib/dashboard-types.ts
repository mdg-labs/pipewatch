import type { PipelineConclusion, PipelineStatus } from "@pipewatch/types";

export type RepoHealth = "healthy" | "running" | "failing";

export type DashboardHealthSummary = {
  healthy: number;
  running: number;
  failing: number;
  total: number;
};

export type DashboardLastRun = {
  id: string;
  external_run_id: string;
  pipeline_name: string;
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
};

export type DashboardRepoCard = {
  id: string;
  full_name: string;
  integration_id: string;
  is_running: boolean;
  health: RepoHealth;
  last_run: DashboardLastRun | null;
  sparkline: number[];
};

export type WorkspaceDashboard = {
  health: DashboardHealthSummary;
  repos: DashboardRepoCard[];
};

export type DashboardSortKey = "last_run" | "name" | "failure_rate";

export type DashboardStatusFilter = "all" | RepoHealth;

export type DashboardViewMode = "cards" | "table";

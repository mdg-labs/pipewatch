/** Insights time range (PRD §12.5, Decision #19). */
export type InsightsRange = "7d" | "30d";

/** Query params for `GET /api/v1/workspaces/:workspaceId/insights`. */
export type InsightsQuery = {
  range: InsightsRange;
  repoId?: string | undefined;
  workflow?: string | undefined;
};

export type InsightsMostActiveRepo = {
  repo_id: string;
  full_name: string;
  run_count: number;
};

export type InsightsSummary = {
  total_runs: number;
  success_rate: number;
  avg_duration_ms: number | null;
  most_active_repo: InsightsMostActiveRepo | null;
  trends: {
    total_runs_percent: number | null;
    success_rate_points: number | null;
    avg_duration_percent: number | null;
  };
};

export type InsightsTimeSeriesPoint = {
  workflow: string;
  repo_id: string;
  repo_full_name: string;
  value: number;
};

export type InsightsTimeSeriesDay = {
  date: string;
  points: InsightsTimeSeriesPoint[];
};

export type InsightsTimeSeries = {
  duration: InsightsTimeSeriesDay[];
  failure_rate: InsightsTimeSeriesDay[];
};

export type InsightsSlowestWorkflow = {
  workflow: string;
  repo_id: string;
  repo_full_name: string;
  avg_duration_ms: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  run_count: number;
  trend_percent: number | null;
};

export type InsightsMostFailingWorkflow = {
  workflow: string;
  repo_id: string;
  repo_full_name: string;
  failure_rate: number;
  failure_count: number;
  run_count: number;
  trend_percent: number | null;
};

/** Workspace insights aggregates (PRD §12.5, pages B7). */
export type WorkspaceInsights = {
  range: InsightsRange;
  summary: InsightsSummary;
  time_series: InsightsTimeSeries;
  slowest_workflows: InsightsSlowestWorkflow[];
  most_failing_workflows: InsightsMostFailingWorkflow[];
};

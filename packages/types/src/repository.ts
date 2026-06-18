/** Repository list/detail API resource (PRD §6, §7 — pages B4/B5). */
export type RepositorySummary = {
  id: string;
  workspace_id: string;
  integration_id: string;
  external_repo_id: string;
  full_name: string;
  private: boolean;
  enabled: boolean;
  polling_interval_seconds: number | null;
  retention_days: number | null;
  last_synced_at: string | null;
};

/** Query filters for `GET /api/v1/workspaces/:workspaceId/repositories`. */
export type ListRepositoriesQuery = {
  enabled?: boolean | undefined;
  integration_id?: string | undefined;
};

/** Body for `PATCH /api/v1/workspaces/:workspaceId/repositories/:repoId`. */
export type UpdateRepositoryInput = {
  enabled?: boolean | undefined;
  polling_interval_seconds?: number | null | undefined;
  retention_days?: number | null | undefined;
};

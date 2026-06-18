/** Mirrors `GET /api/v1/workspaces/:id/sync-status` (PRD §13 step 3). */
export type WorkspaceSyncStatusRepo = {
  id: string;
  enabled: boolean;
  last_synced_at: string | null;
  backfill_in_progress: boolean;
};

export type WorkspaceSyncStatusIntegration = {
  id: string;
  enabled: boolean;
  last_synced_at: string | null;
  backfill_in_progress: boolean;
  repos: WorkspaceSyncStatusRepo[];
};

export type WorkspaceSyncStatus = {
  integrations: WorkspaceSyncStatusIntegration[];
};

export function countBackfillInProgress(status: WorkspaceSyncStatus): number {
  let count = 0;

  for (const integration of status.integrations) {
    for (const repo of integration.repos) {
      if (repo.enabled && repo.backfill_in_progress) {
        count += 1;
      }
    }
  }

  return count;
}

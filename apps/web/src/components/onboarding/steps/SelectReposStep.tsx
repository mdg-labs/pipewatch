"use client";

import { flags } from "@pipewatch/config/edition";
import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { RepositorySummary, Workspace, WorkspacePlan } from "@pipewatch/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, Checkbox, Input, Skeleton, buttonClassName } from "@pipewatch/ui";

import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import {
  countBackfillInProgress,
  type WorkspaceSyncStatus,
} from "@/lib/onboarding/sync-status";
import { useToast } from "@/providers/ToastProvider";

export type SelectReposStepProps = {
  workspace: Workspace;
  onBack: () => void;
  onComplete: (enabledCount: number) => void;
};

const REPO_POLL_MS = 3000;
const SYNC_POLL_MS = 4000;

function repoLimitForPlan(plan: WorkspacePlan): number | null {
  if (!flags.PLAN_LIMITS_ENABLED) {
    return null;
  }

  return getPlanLimits(plan).repoLimit;
}

/** Step 3 — multi-select repos, sync progress, optional plan limit badge. */
export function SelectReposStep({ workspace, onBack, onComplete }: SelectReposStepProps) {
  const { api } = useApi();
  const scopedApi = useMemo(() => api.workspace(workspace.id), [api, workspace.id]);
  const { toast } = useToast();
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<WorkspaceSyncStatus | null>(null);
  const [startedSync, setStartedSync] = useState(false);

  const repoLimit = repoLimitForPlan(workspace.plan);
  const dashboardHref = `/workspaces/${workspace.slug}/`;

  const loadRepos = useCallback(async () => {
    if (!scopedApi) {
      return;
    }

    setLoadError(false);
    try {
      const items = await scopedApi.get<RepositorySummary[]>("/repositories");
      setRepos(items);
      setSelected((current) => {
        if (current.size > 0) {
          return current;
        }

        return new Set(items.map((repo) => repo.id));
      });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [scopedApi]);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    if (!scopedApi || loading) {
      return;
    }

    if (repos.length > 0) {
      return;
    }

    const handle = window.setInterval(() => {
      void loadRepos();
    }, REPO_POLL_MS);

    return () => {
      window.clearInterval(handle);
    };
  }, [loadRepos, loading, repos.length, scopedApi]);

  useEffect(() => {
    if (!scopedApi || !startedSync) {
      return;
    }

    const poll = async () => {
      try {
        const status = await scopedApi.get<WorkspaceSyncStatus>("/sync-status");
        setSyncStatus(status);
      } catch {
        // Keep last known status on transient errors.
      }
    };

    void poll();
    const handle = window.setInterval(() => {
      void poll();
    }, SYNC_POLL_MS);

    return () => {
      window.clearInterval(handle);
    };
  }, [scopedApi, startedSync]);

  const filteredRepos = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return repos;
    }

    return repos.filter((repo) => repo.full_name.toLowerCase().includes(query));
  }, [filter, repos]);

  const selectedCount = selected.size;
  const atLimit = repoLimit !== null && selectedCount >= repoLimit;

  const toggleRepo = useCallback(
    (repoId: string, checked: boolean) => {
      setSelected((current) => {
        const next = new Set(current);
        if (checked) {
          if (repoLimit !== null && next.size >= repoLimit && !next.has(repoId)) {
            return current;
          }
          next.add(repoId);
        } else {
          next.delete(repoId);
        }
        return next;
      });
    },
    [repoLimit],
  );

  const inScopeRepos = useMemo(() => {
    const limit = repoLimit ?? filteredRepos.length;
    return filteredRepos.slice(0, limit);
  }, [filteredRepos, repoLimit]);

  const hasInScopeSelection = useMemo(
    () => filteredRepos.some((repo) => selected.has(repo.id)),
    [filteredRepos, selected],
  );

  const allInScopeSelected = useMemo(
    () => inScopeRepos.length > 0 && inScopeRepos.every((repo) => selected.has(repo.id)),
    [inScopeRepos, selected],
  );

  const handleSelectAll = useCallback(() => {
    const ids = inScopeRepos.map((repo) => repo.id);
    setSelected(new Set(ids));
  }, [inScopeRepos]);

  const handleDeselectAll = useCallback(() => {
    const idsToRemove = new Set(filteredRepos.map((repo) => repo.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of idsToRemove) {
        next.delete(id);
      }
      return next;
    });
  }, [filteredRepos]);

  const handleStartSync = useCallback(async () => {
    if (!scopedApi || selectedCount === 0) {
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        repos.map((repo) =>
          scopedApi.patch(`/repositories/${repo.id}`, {
            enabled: selected.has(repo.id),
          }),
        ),
      );

      setStartedSync(true);

      try {
        const status = await scopedApi.get<WorkspaceSyncStatus>("/sync-status");
        setSyncStatus(status);
      } catch {
        // Progress is best-effort.
      }

      onComplete(selectedCount);
    } catch {
      toast({
        title: "Could not start syncing",
        description: "Try again or continue to the dashboard.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [onComplete, repos, scopedApi, selected, selectedCount, toast]);

  const backfillCount = syncStatus ? countBackfillInProgress(syncStatus) : 0;

  return (
    <>
      <div className="pw-onboarding-card-header">
        <h1 className="pw-onboarding-card-title">Select repositories</h1>
        <p className="pw-onboarding-card-subtitle">
          Choose which repositories PipeWatch should track. You can change this later
          in settings.
        </p>
      </div>

      <div className="pw-onboarding-card-body">
        <div className="pw-onboarding-repo-toolbar">
          <div className="pw-onboarding-repo-search">
            <Input
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
              placeholder="Search repositories…"
              aria-label="Filter repositories"
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            {repoLimit !== null ? (
              <Badge variant={atLimit ? "accent" : "default"}>
                {selectedCount} / {repoLimit} repos
              </Badge>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={allInScopeSelected}
              onClick={handleSelectAll}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!hasInScopeSelection}
              onClick={handleDeselectAll}
            >
              Deselect all
            </Button>
          </div>
        </div>

        {repoLimit !== null ? (
          <p className="pw-onboarding-plan-hint" style={{ marginBottom: "var(--space-3)" }}>
            You can track up to {repoLimit} repos on the Free plan.
          </p>
        ) : null}

        {loading ? (
          <div className="pw-onboarding-loading">
            <Skeleton variant="line" />
            <Skeleton variant="line" />
            <Skeleton variant="line" />
          </div>
        ) : loadError ? (
          <ErrorRetry
            message="We could not load repositories from GitHub."
            onRetry={() => {
              setLoading(true);
              void loadRepos();
            }}
          />
        ) : repos.length === 0 ? (
          <div className="pw-onboarding-empty-repos">
            Discovering repositories from your GitHub installation…
          </div>
        ) : (
          <div className="pw-onboarding-repo-list" role="list">
            {filteredRepos.map((repo) => (
              <label key={repo.id} className="pw-onboarding-repo-row" role="listitem">
                <Checkbox
                  checked={selected.has(repo.id)}
                  disabled={!selected.has(repo.id) && atLimit}
                  onChange={(checked) => {
                    toggleRepo(repo.id, checked);
                  }}
                  aria-label={`Track ${repo.full_name}`}
                />
                <span className="pw-onboarding-repo-name">{repo.full_name}</span>
                {repo.private ? <Badge variant="default">Private</Badge> : null}
              </label>
            ))}
          </div>
        )}

        {startedSync && backfillCount > 0 ? (
          <div className="pw-onboarding-sync-progress" role="status">
            Syncing {backfillCount} {backfillCount === 1 ? "repo" : "repos"} — fetching
            run history…
          </div>
        ) : null}

        <div className="pw-onboarding-dashboard-link">
          <Link
            className={buttonClassName({ variant: "ghost" })}
            href={dashboardHref}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>

      <div className="pw-onboarding-card-footer">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="pw-onboarding-card-footer-actions">
          <Button
            disabled={selectedCount === 0 || submitting || loading}
            onClick={() => void handleStartSync()}
          >
            {submitting ? "Starting…" : "Start syncing"}
          </Button>
        </div>
      </div>
    </>
  );
}

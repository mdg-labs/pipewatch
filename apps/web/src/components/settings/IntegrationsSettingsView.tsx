"use client";

import { flags } from "@pipewatch/config/edition";
import type { IntegrationSummary, RepositorySummary } from "@pipewatch/types";
import { Github } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, Dialog, EmptyState, Input } from "@pipewatch/ui";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { IntegrationCard } from "@/components/settings/IntegrationCard";
import { useApi } from "@/hooks/use-api";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import {
  buildGitHubAppInstallUrl,
  buildGitHubInstallCallbackUrl,
} from "@/lib/onboarding/github";
import {
  type WorkspaceSyncStatus,
  type WorkspaceSyncStatusIntegration,
} from "@/lib/onboarding/sync-status";
import { publicApiUrl } from "@/lib/env";
import { useToast } from "@/providers/ToastProvider";

import "@/components/settings/integrations-settings.css";

const SYNC_POLL_MS = 4000;

export type IntegrationsSettingsViewProps = {
  githubAppSlug?: string;
};

export function IntegrationsSettingsView({ githubAppSlug }: IntegrationsSettingsViewProps) {
  const { workspace, workspaceId } = useApi();
  const { canMutate, readOnly } = useWorkspaceRole();
  const { toast } = useToast();
  const tUi = useTranslations("ui");

  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [repos, setRepos] = useState<RepositorySummary[]>([]);
  const [syncStatusByIntegration, setSyncStatusByIntegration] = useState<
    Record<string, WorkspaceSyncStatusIntegration>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resyncingIds, setResyncingIds] = useState<Set<string>>(() => new Set());
  const [togglingRepoId, setTogglingRepoId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [manualId, setManualId] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<IntegrationSummary | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const installUrl = useMemo(() => buildGitHubAppInstallUrl(githubAppSlug), [githubAppSlug]);
  const installConfigured = installUrl !== null;

  const loadData = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const [integrationData, repoData] = await Promise.all([
        workspace.get<IntegrationSummary[]>("/integrations"),
        workspace.get<RepositorySummary[]>("/repositories"),
      ]);
      setIntegrations(integrationData);
      setRepos(repoData);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pollSyncStatus = useCallback(
    async (integrationId: string) => {
      if (!workspace) {
        return null;
      }

      try {
        const status = await workspace.get<WorkspaceSyncStatus>(
          `/sync-status?integrationId=${encodeURIComponent(integrationId)}`,
        );
        const integrationStatus = status.integrations[0] ?? null;
        if (integrationStatus) {
          setSyncStatusByIntegration((current) => ({
            ...current,
            [integrationId]: integrationStatus,
          }));
        }
        return integrationStatus;
      } catch {
        return null;
      }
    },
    [workspaceId],
  );

  const isIntegrationSyncing = useCallback(
    (integrationId: string, status: WorkspaceSyncStatusIntegration | null): boolean => {
      if (resyncingIds.has(integrationId)) {
        return true;
      }

      if (!status) {
        return false;
      }

      if (status.backfill_in_progress) {
        return true;
      }

      return status.repos.some((repo) => repo.enabled && repo.backfill_in_progress);
    },
    [resyncingIds],
  );

  useEffect(() => {
    if (!workspace || !expandedId) {
      return;
    }

    void pollSyncStatus(expandedId);

    const handle = window.setInterval(() => {
      void pollSyncStatus(expandedId);
    }, SYNC_POLL_MS);

    return () => {
      window.clearInterval(handle);
    };
  }, [expandedId, pollSyncStatus, workspaceId]);

  useEffect(() => {
    if (!workspace || resyncingIds.size === 0) {
      return;
    }

    const pollAll = async () => {
      for (const integrationId of resyncingIds) {
        const status = await pollSyncStatus(integrationId);
        if (status && !isIntegrationSyncing(integrationId, status)) {
          setResyncingIds((current) => {
            const next = new Set(current);
            next.delete(integrationId);
            return next;
          });
        }
      }
    };

    void pollAll();
    const handle = window.setInterval(() => {
      void pollAll();
    }, SYNC_POLL_MS);

    return () => {
      window.clearInterval(handle);
    };
  }, [isIntegrationSyncing, pollSyncStatus, resyncingIds, workspaceId]);

  const reposByIntegration = useMemo(() => {
    const grouped = new Map<string, RepositorySummary[]>();

    for (const repo of repos) {
      const list = grouped.get(repo.integration_id) ?? [];
      list.push(repo);
      grouped.set(repo.integration_id, list);
    }

    for (const list of grouped.values()) {
      list.sort((left, right) => left.full_name.localeCompare(right.full_name));
    }

    return grouped;
  }, [repos]);

  const handleRepoToggle = useCallback(
    async (integrationId: string, repoId: string, enabled: boolean) => {
      if (!workspace || readOnly) {
        return;
      }

      setTogglingRepoId(repoId);
      try {
        const updated = await workspace.patch<RepositorySummary>(`/repositories/${repoId}`, {
          enabled,
        });
        setRepos((current) =>
          current.map((repo) => (repo.id === updated.id ? updated : repo)),
        );
        setIntegrations((current) =>
          current.map((integration) => {
            if (integration.id !== integrationId) {
              return integration;
            }

            const delta = enabled ? 1 : -1;
            return {
              ...integration,
              connected_repo_count: Math.max(0, integration.connected_repo_count + delta),
            };
          }),
        );
        toast({
          title: enabled ? "Repository enabled" : "Repository disabled",
          variant: "success",
        });
      } catch {
        toast({
          title: "Could not update repository",
          variant: "error",
        });
      } finally {
        setTogglingRepoId(null);
      }
    },
    [readOnly, toast, workspaceId],
  );

  const handleResync = useCallback(
    async (integration: IntegrationSummary) => {
      if (!workspace || readOnly) {
        return;
      }

      const integrationRepos = reposByIntegration.get(integration.id) ?? [];
      const enabledRepos = integrationRepos.filter((repo) => repo.enabled);

      if (enabledRepos.length === 0) {
        toast({
          title: "No enabled repositories",
          description: "Enable at least one repository before re-syncing.",
          variant: "error",
        });
        return;
      }

      setResyncingIds((current) => new Set(current).add(integration.id));
      setExpandedId(integration.id);

      try {
        await Promise.all(
          enabledRepos.map((repo) => workspace.post(`/repositories/${repo.id}/sync`)),
        );
        await pollSyncStatus(integration.id);
        toast({
          title: "Re-sync started",
          variant: "success",
        });
      } catch {
        setResyncingIds((current) => {
          const next = new Set(current);
          next.delete(integration.id);
          return next;
        });
        toast({
          title: "Could not start re-sync",
          variant: "error",
        });
      }
    },
    [pollSyncStatus, readOnly, reposByIntegration, toast, workspaceId],
  );

  const handleRemove = useCallback(async () => {
    if (!workspace || !removeTarget) {
      return;
    }

    setRemoveLoading(true);
    try {
      await workspace.delete(`/integrations/${removeTarget.id}`);
      setIntegrations((current) =>
        current.filter((integration) => integration.id !== removeTarget.id),
      );
      setRepos((current) =>
        current.filter((repo) => repo.integration_id !== removeTarget.id),
      );
      setSyncStatusByIntegration((current) => {
        const next = { ...current };
        delete next[removeTarget.id];
        return next;
      });
      if (expandedId === removeTarget.id) {
        setExpandedId(null);
      }
      toast({
        title: "Integration removed",
        variant: "success",
      });
      setRemoveTarget(null);
    } catch {
      toast({
        title: "Could not remove integration",
        variant: "error",
      });
    } finally {
      setRemoveLoading(false);
    }
  }, [expandedId, removeTarget, toast, workspaceId]);

  const handleManualConnect = useCallback(() => {
    const trimmed = manualId.trim();
    if (!trimmed) {
      return;
    }

    setSubmittingManual(true);
    window.location.href = buildGitHubInstallCallbackUrl(publicApiUrl, trimmed);
  }, [manualId]);

  if (loading) {
    return (
      <div className="pw-integrations-settings">
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorRetry
        message="We could not load integrations. Check your connection and try again."
        onRetry={() => {
          void loadData();
        }}
      />
    );
  }

  return (
    <div className="pw-integrations-settings">
      <header className="pw-integrations-settings-header">
        <div>
          <h1>Integrations</h1>
          <p>Connect GitHub App installations and choose which repositories to track.</p>
          <div className="pw-integrations-header-badges">
            <Badge variant="outline" pill>
              MVP: GitHub only
            </Badge>
          </div>
        </div>
        {canMutate ? (
          <Button
            onClick={() => {
              setAddOpen(true);
            }}
          >
            Add integration
          </Button>
        ) : null}
      </header>

      {integrations.length === 0 ? (
        <EmptyState
          icon={<Github size={24} strokeWidth={1.75} aria-hidden />}
          title="No integrations connected"
          description="Install the PipeWatch GitHub App to start tracking workflow runs."
          actions={
            canMutate ? (
              <Button
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                Add integration
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="pw-integrations-list">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              repos={reposByIntegration.get(integration.id) ?? []}
              syncStatus={syncStatusByIntegration[integration.id] ?? null}
              expanded={expandedId === integration.id}
              readOnly={readOnly}
              resyncing={resyncingIds.has(integration.id)}
              togglingRepoId={togglingRepoId}
              onToggleExpand={() => {
                setExpandedId((current) =>
                  current === integration.id ? null : integration.id,
                );
              }}
              onResync={() => {
                void handleResync(integration);
              }}
              onRemove={() => {
                setRemoveTarget(integration);
              }}
              onRepoToggle={(repoId, enabled) => {
                void handleRepoToggle(integration.id, repoId, enabled);
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onClose={() => {
          if (!submittingManual) {
            setAddOpen(false);
          }
        }}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        title="Add GitHub integration"
        description="Install the PipeWatch GitHub App on your account or organization."
        size="sm"
        footer={
          <div className="pw-integrations-actions">
            <Button
              variant="secondary"
              disabled={submittingManual}
              onClick={() => {
                setAddOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!installConfigured}
              onClick={() => {
                if (installUrl) {
                  window.open(installUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <Github size={16} strokeWidth={2} aria-hidden />
              Install GitHub App
            </Button>
          </div>
        }
      >
        <div className="pw-integrations-add-body">
          {installConfigured ? null : (
            <p className="pw-integrations-add-hint" role="alert">
              GitHub App install is not configured. Set <code>GITHUB_APP_SLUG</code> on the API
              server and refresh this page.
            </p>
          )}
          <p className="pw-integrations-add-hint">
            After installing, GitHub redirects back to PipeWatch to finish connecting
            repositories.
          </p>
          {flags.IS_CE ? (
            <div>
              <p className="pw-integrations-add-hint">
                Already installed? Enter your installation ID manually.
              </p>
              <div className="pw-integrations-manual-row">
                <Input
                  value={manualId}
                  onChange={(event) => {
                    setManualId(event.target.value);
                  }}
                  placeholder="12345678"
                  mono
                  aria-label="GitHub installation ID"
                />
                <Button
                  variant="secondary"
                  disabled={!manualId.trim() || submittingManual}
                  onClick={handleManualConnect}
                >
                  Connect
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onClose={() => {
          if (!removeLoading) {
            setRemoveTarget(null);
          }
        }}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        title="Remove integration"
        {...(removeTarget
          ? {
              description: `Disconnect ${removeTarget.account_login}? All tracked repositories for this installation will be disabled and removed.`,
            }
          : {})}
        size="sm"
        footer={
          <div className="pw-integrations-actions">
            <Button
              variant="secondary"
              disabled={removeLoading}
              onClick={() => {
                setRemoveTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeLoading}
              disabled={removeLoading}
              onClick={() => {
                void handleRemove();
              }}
            >
              Remove integration
            </Button>
          </div>
        }
      />
    </div>
  );
}

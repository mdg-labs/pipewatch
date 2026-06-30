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
  const { workspace, workspaceId, workspaceStatus } = useApi();
  const { canMutate, readOnly } = useWorkspaceRole();
  const { toast } = useToast();
  const t = useTranslations("settings.integrations");
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
      if (workspaceStatus === "unresolved") {
        setLoading(false);
        setLoadError(true);
      }
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
  }, [workspaceId, workspaceStatus]);

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
          title: enabled ? t("toast.repoEnabledTitle") : t("toast.repoDisabledTitle"),
          variant: "success",
        });
      } catch {
        toast({
          title: t("toast.repoUpdateErrorTitle"),
          variant: "error",
        });
      } finally {
        setTogglingRepoId(null);
      }
    },
    [readOnly, t, toast, workspaceId],
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
          title: t("toast.noEnabledReposTitle"),
          description: t("toast.noEnabledReposDescription"),
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
          title: t("toast.resyncStartedTitle"),
          variant: "success",
        });
      } catch {
        setResyncingIds((current) => {
          const next = new Set(current);
          next.delete(integration.id);
          return next;
        });
        toast({
          title: t("toast.resyncErrorTitle"),
          variant: "error",
        });
      }
    },
    [pollSyncStatus, readOnly, reposByIntegration, t, toast, workspaceId],
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
        title: t("toast.removedTitle"),
        variant: "success",
      });
      setRemoveTarget(null);
    } catch {
      toast({
        title: t("toast.removeErrorTitle"),
        variant: "error",
      });
    } finally {
      setRemoveLoading(false);
    }
  }, [expandedId, removeTarget, t, toast, workspaceId]);

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
        message={t("loadError")}
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
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
          <div className="pw-integrations-header-badges">
            <Badge variant="outline" pill>
              {t("mvpBadge")}
            </Badge>
          </div>
        </div>
        {canMutate ? (
          <Button
            onClick={() => {
              setAddOpen(true);
            }}
          >
            {t("addButton")}
          </Button>
        ) : null}
      </header>

      {integrations.length === 0 ? (
        <EmptyState
          icon={<Github size={24} strokeWidth={1.75} aria-hidden />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actions={
            canMutate ? (
              <Button
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                {t("addButton")}
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
        title={t("addDialog.title")}
        description={t("addDialog.description")}
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
              {tUi("typedConfirm.cancel")}
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
              {t("addDialog.installButton")}
            </Button>
          </div>
        }
      >
        <div className="pw-integrations-add-body">
          {installConfigured ? null : (
            <p className="pw-integrations-add-hint" role="alert">
              {t("addDialog.notConfigured")}
            </p>
          )}
          <p className="pw-integrations-add-hint">{t("addDialog.redirectHint")}</p>
          {flags.IS_CE ? (
            <div>
              <p className="pw-integrations-add-hint">{t("addDialog.manualHint")}</p>
              <div className="pw-integrations-manual-row">
                <Input
                  value={manualId}
                  onChange={(event) => {
                    setManualId(event.target.value);
                  }}
                  placeholder={t("addDialog.installationIdPlaceholder")}
                  mono
                  aria-label={t("addDialog.installationIdAriaLabel")}
                />
                <Button
                  variant="secondary"
                  disabled={!manualId.trim() || submittingManual}
                  onClick={handleManualConnect}
                >
                  {t("addDialog.connect")}
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
        title={t("removeDialog.title")}
        {...(removeTarget
          ? {
              description: t("removeDialog.description", {
                accountLogin: removeTarget.account_login,
              }),
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
              {tUi("typedConfirm.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={removeLoading}
              disabled={removeLoading}
              onClick={() => {
                void handleRemove();
              }}
            >
              {t("removeDialog.confirmButton")}
            </Button>
          </div>
        }
      />
    </div>
  );
}

"use client";

import type {
  IntegrationAccountType,
  IntegrationSummary,
  IntegrationTokenHealth,
  RepositorySummary,
} from "@pipewatch/types";
import { ChevronDown, ChevronUp, Github } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge, Button, Switch } from "@pipewatch/ui";

import type { WorkspaceSyncStatusIntegration } from "@/lib/onboarding/sync-status";

import "./integration-card.css";

const TOKEN_HEALTH_VARIANT = {
  healthy: "success",
  expiring: "accent",
  expired: "failure",
} as const;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function countBackfillInProgress(
  syncStatus: WorkspaceSyncStatusIntegration | null,
): number {
  if (!syncStatus) {
    return 0;
  }

  return syncStatus.repos.filter((repo) => repo.enabled && repo.backfill_in_progress).length;
}

export type IntegrationCardProps = {
  integration: IntegrationSummary;
  repos: RepositorySummary[];
  syncStatus: WorkspaceSyncStatusIntegration | null;
  expanded: boolean;
  readOnly: boolean;
  resyncing: boolean;
  togglingRepoId: string | null;
  onToggleExpand: () => void;
  onResync: () => void;
  onRemove: () => void;
  onRepoToggle: (repoId: string, enabled: boolean) => void;
};

/** B10 integration card — summary, token health, per-repo toggles, re-sync progress. */
export function IntegrationCard({
  integration,
  repos,
  syncStatus,
  expanded,
  readOnly,
  resyncing,
  togglingRepoId,
  onToggleExpand,
  onResync,
  onRemove,
  onRepoToggle,
}: IntegrationCardProps) {
  const t = useTranslations("settings.integrations.card");

  const accountTypeLabel = useMemo(() => {
    const labels: Record<IntegrationAccountType, string> = {
      Organization: t("accountTypeOrg"),
      User: t("accountTypeUser"),
    };
    return labels[integration.account_type];
  }, [integration.account_type, t]);

  const tokenHealthLabel = useMemo(() => {
    const labels: Record<IntegrationTokenHealth, string> = {
      healthy: t("tokenHealthHealthy"),
      expiring: t("tokenHealthExpiring"),
      expired: t("tokenHealthExpired"),
    };
    return labels[integration.token_health];
  }, [integration.token_health, t]);

  const backfillCount = countBackfillInProgress(syncStatus);
  const showSyncProgress = resyncing || backfillCount > 0 || syncStatus?.backfill_in_progress;

  return (
    <article className="pw-integration-card" aria-labelledby={`pw-int-${integration.id}-title`}>
      <div className="pw-integration-card-header">
        <div className="pw-integration-card-summary">
          <div className="pw-integration-card-title-row">
            <Github size={18} strokeWidth={2} aria-hidden />
            <h2
              id={`pw-int-${integration.id}-title`}
              className="pw-integration-card-title"
            >
              {integration.account_login}
            </h2>
            <Badge variant="outline" pill>
              {accountTypeLabel}
            </Badge>
            <Badge variant="default" pill>
              {t("github")}
            </Badge>
          </div>
          <div className="pw-integration-card-meta">
            <span>
              {t("reposConnected", { count: integration.connected_repo_count })}
            </span>
            <span>{t("connectedAt", { date: formatDate(integration.created_at) })}</span>
          </div>
        </div>

        <div className="pw-integration-card-actions">
          {!readOnly ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={resyncing}
                disabled={resyncing}
                onClick={onResync}
              >
                {t("resync")}
              </Button>
              <Button variant="danger" size="sm" onClick={onRemove}>
                {t("remove")}
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="pw-integration-card-expand"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            {expanded ? (
              <>
                {t("collapse")}
                <ChevronUp size={14} strokeWidth={2} aria-hidden />
              </>
            ) : (
              <>
                {t("expand")}
                <ChevronDown size={14} strokeWidth={2} aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="pw-integration-card-body">
          <div className="pw-integration-card-token">
            <span className="pw-integration-card-token-label">{t("tokenHealth")}</span>
            <Badge variant={TOKEN_HEALTH_VARIANT[integration.token_health]} pill>
              {tokenHealthLabel}
            </Badge>
            {integration.token_expires_at ? (
              <span className="pw-integration-card-token-label">
                {t("tokenRefreshDue", { dateTime: formatDateTime(integration.token_expires_at) })}
              </span>
            ) : (
              <span className="pw-integration-card-token-label">{t("tokenNoExpiry")}</span>
            )}
            {syncStatus?.last_synced_at ? (
              <span className="pw-integration-card-token-label">
                {t("lastSynced", { dateTime: formatDateTime(syncStatus.last_synced_at) })}
              </span>
            ) : null}
          </div>

          {showSyncProgress ? (
            <div className="pw-integration-card-sync-progress" role="status">
              {backfillCount > 0
                ? t("syncProgressRepos", { count: backfillCount })
                : t("syncProgressResync")}
            </div>
          ) : null}

          <div className="pw-integration-card-repos">
            <h3 className="pw-integration-card-repos-title">{t("reposTitle")}</h3>
            {repos.length === 0 ? (
              <p className="pw-integration-card-empty-repos">{t("reposEmpty")}</p>
            ) : (
              repos.map((repo) => {
                const repoSync = syncStatus?.repos.find((item) => item.id === repo.id);
                const repoSyncing = repoSync?.backfill_in_progress ?? false;

                return (
                  <div key={repo.id} className="pw-integration-card-repo-row">
                    <span className="pw-integration-card-repo-name">{repo.full_name}</span>
                    <div className="pw-integration-card-repo-meta">
                      {repoSyncing ? (
                        <span className="pw-integration-card-repo-sync">{t("repoSyncing")}</span>
                      ) : repoSync?.last_synced_at ? (
                        <span className="pw-integration-card-repo-sync">
                          {t("repoSynced", { date: formatDate(repoSync.last_synced_at) })}
                        </span>
                      ) : null}
                      {repo.private ? (
                        <Badge variant="outline" pill>
                          {t("privateBadge")}
                        </Badge>
                      ) : null}
                      <Switch
                        checked={repo.enabled}
                        disabled={readOnly || togglingRepoId === repo.id}
                        onChange={(checked) => {
                          onRepoToggle(repo.id, checked);
                        }}
                        aria-label={
                          repo.enabled
                            ? t("disableRepoAriaLabel", { fullName: repo.full_name })
                            : t("enableRepoAriaLabel", { fullName: repo.full_name })
                        }
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

"use client";

import type { IntegrationSummary } from "@pipewatch/types";
import { EmptyState, buttonClassName } from "@pipewatch/ui";
import { Github } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useSetLiveStreamOverride } from "@/contexts/live-stream-override-context";
import { useApi } from "@/hooks/use-api";
import { useDashboardStream } from "@/hooks/use-dashboard-stream";
import type {
  DashboardSortKey,
  DashboardStatusFilter,
  DashboardViewMode,
  WorkspaceDashboard,
} from "@/lib/dashboard-types";
import {
  applySseEventToDashboard,
  filterDashboardRepos,
  sortDashboardRepos,
} from "@/lib/dashboard-utils";

import { DashboardControls } from "./DashboardControls";
import { DashboardRepoCardView } from "./DashboardRepoCard";
import { DashboardRepoTable } from "./DashboardRepoTable";
import { HealthBar } from "./HealthBar";

import "./dashboard.css";

const VIEW_STORAGE_KEY = "pw-dashboard-view";

function readStoredViewMode(): DashboardViewMode {
  if (typeof window === "undefined") {
    return "cards";
  }

  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "table" ? "table" : "cards";
}

export type DashboardViewProps = {
  workspaceSlug: string;
};

export function DashboardView({ workspaceSlug }: DashboardViewProps) {
  const t = useTranslations("dashboard");
  const { workspace, workspaceId } = useApi();
  const setLiveStreamOverride = useSetLiveStreamOverride();

  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sortKey, setSortKey] = useState<DashboardSortKey>("last_run");
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>("all");
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("cards");

  useEffect(() => {
    setViewMode(readStoredViewMode());
  }, []);

  const handleViewModeChange = useCallback((mode: DashboardViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const [dashboardData, integrationData] = await Promise.all([
        workspace.get<WorkspaceDashboard>("/dashboard"),
        workspace.get<IntegrationSummary[]>("/integrations"),
      ]);
      setDashboard(dashboardData);
      setIntegrations(integrationData);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const repoIds = useMemo(
    () => dashboard?.repos.map((repo) => repo.id) ?? [],
    [dashboard?.repos],
  );

  const handleSseEvent = useCallback((repoId: string, event: Parameters<typeof applySseEventToDashboard>[2]) => {
    setDashboard((current) =>
      current ? applySseEventToDashboard(current, repoId, event) : current,
    );
  }, []);

  const { status: liveStatus } = useDashboardStream({
    repoIds,
    enabled: Boolean(dashboard && dashboard.repos.length > 0),
    onEvent: handleSseEvent,
  });

  useEffect(() => {
    if (!dashboard || dashboard.repos.length === 0) {
      setLiveStreamOverride(null);
      return;
    }

    setLiveStreamOverride(liveStatus);
    return () => {
      setLiveStreamOverride(null);
    };
  }, [dashboard, liveStatus, setLiveStreamOverride]);

  const filteredRepos = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return sortDashboardRepos(
      filterDashboardRepos(dashboard.repos, statusFilter, integrationId),
      sortKey,
    );
  }, [dashboard, integrationId, sortKey, statusFilter]);

  const resultsLabel = t("resultsCount", { count: filteredRepos.length });
  const onboardingHref = `/onboarding?step=2&workspace=${encodeURIComponent(workspaceSlug)}`;

  if (loading) {
    return (
      <div className="pw-dashboard" aria-busy="true">
        <div className="pw-dashboard-header">
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        </div>
        {viewMode === "table" ? (
          <TableSkeleton columns={7} rows={6} />
        ) : (
          <CardSkeleton count={6} />
        )}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pw-dashboard">
        <div className="pw-dashboard-header">
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        </div>
        <ErrorRetry message={t("loadError")} onRetry={() => void loadDashboard()} />
      </div>
    );
  }

  if (!dashboard || dashboard.health.total === 0) {
    return (
      <div className="pw-dashboard">
        <div className="pw-dashboard-header">
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        </div>
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          actions={
            <Link href={onboardingHref} className={buttonClassName({ variant: "primary" })}>
              <Github size={16} aria-hidden />
              {t("empty.connectGithub")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="pw-dashboard">
      <div className="pw-dashboard-header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        <div className="pw-dashboard-header-actions">
          <Link
            href={onboardingHref}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            {t("connectAnotherOrg")}
          </Link>
        </div>
      </div>

      <HealthBar health={dashboard.health} />

      <DashboardControls
        sortKey={sortKey}
        onSortChange={setSortKey}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        integrationId={integrationId}
        onIntegrationChange={setIntegrationId}
        integrations={integrations}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        resultsLabel={resultsLabel}
      />

      {viewMode === "table" ? (
        <DashboardRepoTable repos={filteredRepos} workspaceSlug={workspaceSlug} />
      ) : (
        <div className="pw-dashboard-repo-grid">
          {filteredRepos.map((repo) => (
            <DashboardRepoCardView key={repo.id} repo={repo} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

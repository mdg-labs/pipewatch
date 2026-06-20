"use client";

import type { RepositorySummary } from "@pipewatch/types";
import { Badge, Button, buttonClassName } from "@pipewatch/ui";
import { GitBranch, Github, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { githubRepoUrl, parseRepoFullName } from "@/lib/dashboard-utils";

import "./repo-detail.css";

export type RepoHeaderProps = {
  repository: RepositorySummary;
  workspaceSlug: string;
  syncing?: boolean;
  onResync?: () => void;
  canResync?: boolean;
};

function syncModeLabel(
  repository: RepositorySummary,
  t: (key: "polling" | "webhookLive", values?: { seconds: number }) => string,
): { label: string; live: boolean } {
  if (repository.polling_interval_seconds !== null) {
    return {
      label: t("polling", { seconds: repository.polling_interval_seconds }),
      live: false,
    };
  }

  return {
    label: t("webhookLive"),
    live: true,
  };
}

export function RepoHeader({
  repository,
  workspaceSlug,
  syncing = false,
  onResync,
  canResync = false,
}: RepoHeaderProps) {
  const t = useTranslations("repos.header");
  const { org, name } = parseRepoFullName(repository.full_name);
  const syncMode = syncModeLabel(repository, t);
  const settingsHref = `/workspaces/${workspaceSlug}/repos/${repository.id}/settings`;

  return (
    <header className="pw-repo-header">
      <div className="pw-repo-header-main">
        <GitBranch size={18} aria-hidden style={{ color: "var(--text-secondary)", flexShrink: 0 }} />

        <div className="pw-repo-header-name">
          {org ? <span className="pw-repo-header-org">{org} /</span> : null}
          <span className="pw-repo-header-repo">{name}</span>
        </div>

        <Badge variant="outline" mono pill>
          {repository.private ? t("private") : t("public")}
        </Badge>

        <Badge
          variant="success"
          pill
          className={syncMode.live ? "pw-repo-sync-badge pw-repo-sync-badge-live" : "pw-repo-sync-badge"}
        >
          <span className="pw-repo-sync-dot" aria-hidden />
          {syncMode.label}
        </Badge>

        <a
          href={githubRepoUrl(repository.full_name)}
          target="_blank"
          rel="noopener noreferrer"
          className="pw-repo-github-link"
          aria-label={t("openOnGithubAriaLabel", { fullName: repository.full_name })}
        >
          <Github size={15} aria-hidden />
        </a>
      </div>

      <div className="pw-repo-header-actions">
        <Link href={settingsHref} className={buttonClassName({ variant: "ghost", size: "sm" })}>
          <Settings size={14} aria-hidden />
          {t("settings")}
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canResync || syncing}
          onClick={onResync}
        >
          {syncing ? t("resyncing") : t("resync")}
        </Button>
      </div>
    </header>
  );
}

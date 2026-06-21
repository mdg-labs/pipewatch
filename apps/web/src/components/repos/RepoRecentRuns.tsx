"use client";

import type { PipelineRun } from "@pipewatch/types";
import { buttonClassName } from "@pipewatch/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { RunListTable } from "@/components/runs/RunListTable";

import "./repo-detail.css";

export type RepoRecentRunsProps = {
  runs: PipelineRun[];
  workspaceSlug: string;
  repoId: string;
  viewAllHref: string;
};

export function RepoRecentRuns({ runs, workspaceSlug, repoId, viewAllHref }: RepoRecentRunsProps) {
  const t = useTranslations("repos.overview.recentRuns");

  if (runs.length === 0) {
    return null;
  }

  return (
    <section className="pw-repo-overview-recent" aria-labelledby="pw-repo-overview-recent-title">
      <header className="pw-repo-overview-recent-header">
        <h2 id="pw-repo-overview-recent-title" className="pw-repo-overview-section-title">
          {t("title")}
        </h2>
        <Link href={viewAllHref} className={buttonClassName({ variant: "ghost", size: "sm" })}>
          {t("viewAll")}
        </Link>
      </header>
      <RunListTable runs={runs} workspaceSlug={workspaceSlug} repoId={repoId} />
    </section>
  );
}

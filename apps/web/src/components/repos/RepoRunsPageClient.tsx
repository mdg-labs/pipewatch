"use client";

import { TableSkeleton } from "@/components/TableSkeleton";
import { RepoRunsListView } from "@/components/repos/RepoRunsListView";

export type RepoRunsPageClientProps = {
  workspaceSlug: string;
  repoId: string;
};

export function RepoRunsPageClient({ workspaceSlug, repoId }: RepoRunsPageClientProps) {
  return <RepoRunsListView workspaceSlug={workspaceSlug} repoId={repoId} />;
}

export function RepoRunsPageFallback() {
  return <TableSkeleton columns={8} rows={8} />;
}

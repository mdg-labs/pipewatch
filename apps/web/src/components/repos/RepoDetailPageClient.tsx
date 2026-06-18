"use client";

import { TableSkeleton } from "@/components/TableSkeleton";
import { RepoDetailView } from "@/components/repos/RepoDetailView";

export type RepoDetailPageClientProps = {
  workspaceSlug: string;
  repoId: string;
};

export function RepoDetailPageClient({ workspaceSlug, repoId }: RepoDetailPageClientProps) {
  return <RepoDetailView workspaceSlug={workspaceSlug} repoId={repoId} />;
}

export function RepoDetailPageFallback() {
  return <TableSkeleton columns={8} rows={8} />;
}

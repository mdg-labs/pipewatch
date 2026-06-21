"use client";

import { CardSkeleton } from "@/components/CardSkeleton";
import { RepoOverviewView } from "@/components/repos/RepoOverviewView";

export type RepoDetailPageClientProps = {
  workspaceSlug: string;
  repoId: string;
};

export function RepoDetailPageClient({ workspaceSlug, repoId }: RepoDetailPageClientProps) {
  return <RepoOverviewView workspaceSlug={workspaceSlug} repoId={repoId} />;
}

export function RepoDetailPageFallback() {
  return <CardSkeleton count={3} />;
}

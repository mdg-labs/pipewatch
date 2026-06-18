import { Suspense } from "react";

import {
  RepoDetailPageClient,
  RepoDetailPageFallback,
} from "@/components/repos/RepoDetailPageClient";

export type RepositoryDetailPageProps = {
  params: Promise<{ slug: string; repoId: string }>;
};

/** Repository detail / run list (pages B4). */
export default async function RepositoryDetailPage({ params }: RepositoryDetailPageProps) {
  const { slug, repoId } = await params;

  return (
    <Suspense fallback={<RepoDetailPageFallback />}>
      <RepoDetailPageClient workspaceSlug={slug} repoId={repoId} />
    </Suspense>
  );
}

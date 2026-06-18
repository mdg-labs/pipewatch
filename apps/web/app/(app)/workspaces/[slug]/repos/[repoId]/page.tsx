import { RepoDetailPageClient } from "@/components/repos/RepoDetailPageClient";

export type RepoDetailPageProps = {
  params: Promise<{ slug: string; repoId: string }>;
};

/** Repository run list and workflow tabs (pages B4). */
export default async function RepoDetailPage({ params }: RepoDetailPageProps) {
  const { slug, repoId } = await params;

  return <RepoDetailPageClient workspaceSlug={slug} repoId={repoId} />;
}

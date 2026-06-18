import { RunDetailView } from "@/components/runs/RunDetailView";

export type RunDetailPageProps = {
  params: Promise<{ slug: string; repoId: string; runId: string }>;
};

/** Workflow run drill-down (pages B6). */
export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { slug, repoId, runId } = await params;

  return <RunDetailView workspaceSlug={slug} repoId={repoId} runId={runId} />;
}

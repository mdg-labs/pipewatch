import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RunDetailView } from "@/components/runs/RunDetailView";

export type RunDetailPageProps = {
  params: Promise<{ slug: string; repoId: string; runId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("runs");
  return { title: t("title") };
}

/** Workflow run drill-down (pages B6). */
export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { slug, repoId, runId } = await params;

  return <RunDetailView workspaceSlug={slug} repoId={repoId} runId={runId} />;
}

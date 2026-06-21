import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RepoRunsPageClient } from "@/components/repos/RepoRunsPageClient";

export type RepoRunsPageProps = {
  params: Promise<{ slug: string; repoId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("repos.runs");
  return { title: t("title") };
}

/** Repository runs list (pages B4-runs). */
export default async function RepoRunsPage({ params }: RepoRunsPageProps) {
  const { slug, repoId } = await params;

  return <RepoRunsPageClient workspaceSlug={slug} repoId={repoId} />;
}

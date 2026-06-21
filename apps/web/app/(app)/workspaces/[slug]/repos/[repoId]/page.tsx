import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RepoDetailPageClient } from "@/components/repos/RepoDetailPageClient";

export type RepoDetailPageProps = {
  params: Promise<{ slug: string; repoId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("repos");
  return { title: t("title") };
}

/** Repository overview dashboard (pages B4). */
export default async function RepoDetailPage({ params }: RepoDetailPageProps) {
  const { slug, repoId } = await params;

  return <RepoDetailPageClient workspaceSlug={slug} repoId={repoId} />;
}

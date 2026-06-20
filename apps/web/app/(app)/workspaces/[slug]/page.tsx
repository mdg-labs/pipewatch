import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DashboardView } from "@/components/dashboard/DashboardView";

export type WorkspaceDashboardPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

/** Workspace dashboard — bird's-eye view of all connected repos (pages B3). */
export default async function WorkspaceDashboardPage({
  params,
}: WorkspaceDashboardPageProps) {
  const { slug } = await params;

  return <DashboardView workspaceSlug={slug} />;
}

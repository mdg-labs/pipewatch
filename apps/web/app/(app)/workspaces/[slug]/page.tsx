import { DashboardView } from "@/components/dashboard/DashboardView";

export type WorkspaceDashboardPageProps = {
  params: Promise<{ slug: string }>;
};

/** Workspace dashboard — bird's-eye view of all connected repos (pages B3). */
export default async function WorkspaceDashboardPage({
  params,
}: WorkspaceDashboardPageProps) {
  const { slug } = await params;

  return <DashboardView workspaceSlug={slug} />;
}

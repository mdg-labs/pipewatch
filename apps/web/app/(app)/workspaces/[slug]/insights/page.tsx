import { Suspense } from "react";

import {
  InsightsPageClient,
  InsightsPageFallback,
} from "@/components/insights/InsightsPageClient";

export type WorkspaceInsightsPageProps = {
  params: Promise<{ slug: string }>;
};

/** Workspace insights — performance and reliability trends (pages B7). */
export default async function WorkspaceInsightsPage({ params }: WorkspaceInsightsPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<InsightsPageFallback />}>
      <InsightsPageClient workspaceSlug={slug} />
    </Suspense>
  );
}

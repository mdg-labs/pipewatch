"use client";

import { CardSkeleton } from "@/components/CardSkeleton";

import { InsightsView } from "./InsightsView";

import "./insights.css";

export type InsightsPageClientProps = {
  workspaceSlug: string;
};

export function InsightsPageClient({ workspaceSlug }: InsightsPageClientProps) {
  return <InsightsView workspaceSlug={workspaceSlug} />;
}

export function InsightsPageFallback() {
  return (
    <div className="pw-insights" aria-busy="true" aria-label="Loading insights">
      <CardSkeleton count={4} />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("insights");

  return (
    <div className="pw-insights" aria-busy="true" aria-label={t("loadingAriaLabel")}>
      <CardSkeleton count={4} />
    </div>
  );
}

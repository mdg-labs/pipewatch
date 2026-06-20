"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button, buttonClassName } from "@pipewatch/ui";

export type DoneStepProps = {
  workspaceSlug: string;
  enabledRepoCount: number;
  onBack?: () => void;
};

/** Step 4 — success summary, tips, and dashboard CTA. */
export function DoneStep({ workspaceSlug, enabledRepoCount, onBack }: DoneStepProps) {
  const t = useTranslations("onboarding.done");
  const tCommon = useTranslations("onboarding.common");
  const dashboardHref = `/workspaces/${workspaceSlug}/`;

  return (
    <>
      <div className="pw-onboarding-card-header">
        <div className="pw-onboarding-success-icon" aria-hidden>
          <Check size={24} strokeWidth={2.5} />
        </div>
        <h1 className="pw-onboarding-card-title">{t("title")}</h1>
        <p className="pw-onboarding-card-subtitle">
          {t("subtitle", { count: enabledRepoCount })}
        </p>
      </div>

      <div className="pw-onboarding-card-body">
        <ul className="pw-onboarding-tips">
          <li>{t("tipLiveUpdates")}</li>
          <li>{t("tipPolling")}</li>
          <li>{t("tipInvite")}</li>
        </ul>
      </div>

      <div className="pw-onboarding-card-footer">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            {tCommon("back")}
          </Button>
        ) : (
          <span />
        )}
        <div className="pw-onboarding-card-footer-actions">
          <Link
            className={buttonClassName({ variant: "primary" })}
            href={dashboardHref}
          >
            {tCommon("goToDashboard")}
          </Link>
        </div>
      </div>
    </>
  );
}

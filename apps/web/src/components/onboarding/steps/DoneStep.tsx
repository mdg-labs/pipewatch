"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { Button, buttonClassName } from "@pipewatch/ui";

export type DoneStepProps = {
  workspaceSlug: string;
  enabledRepoCount: number;
  onBack?: () => void;
};

/** Step 4 — success summary, tips, and dashboard CTA. */
export function DoneStep({ workspaceSlug, enabledRepoCount, onBack }: DoneStepProps) {
  const dashboardHref = `/workspaces/${workspaceSlug}/`;

  return (
    <>
      <div className="pw-onboarding-card-header">
        <div className="pw-onboarding-success-icon" aria-hidden>
          <Check size={24} strokeWidth={2.5} />
        </div>
        <h1 className="pw-onboarding-card-title">You&apos;re all set</h1>
        <p className="pw-onboarding-card-subtitle">
          {enabledRepoCount}{" "}
          {enabledRepoCount === 1 ? "repository" : "repositories"} connected. Backfill is
          running in the background.
        </p>
      </div>

      <div className="pw-onboarding-card-body">
        <ul className="pw-onboarding-tips">
          <li>Live updates appear automatically on your dashboard.</li>
          <li>Set up polling mode per repo in repository settings.</li>
          <li>Invite teammates from workspace settings when you&apos;re ready.</li>
        </ul>
      </div>

      <div className="pw-onboarding-card-footer">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="pw-onboarding-card-footer-actions">
          <Link
            className={buttonClassName({ variant: "primary" })}
            href={dashboardHref}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}

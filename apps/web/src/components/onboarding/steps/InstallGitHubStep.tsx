"use client";

import { flags } from "@pipewatch/config/edition";
import { Check, Github, Minus } from "lucide-react";
import { useCallback, useState } from "react";

import { Button, Input } from "@pipewatch/ui";

import {
  buildGitHubAppInstallUrl,
  buildGitHubInstallCallbackUrl,
} from "@/lib/onboarding/github";
import { publicApiUrl } from "@/lib/env";

export type InstallGitHubStepProps = {
  githubAppSlug?: string;
  onBack?: () => void;
};

/** Step 2 — GitHub App permissions explainer and install CTA. */
export function InstallGitHubStep({ githubAppSlug, onBack }: InstallGitHubStepProps) {
  const installUrl = buildGitHubAppInstallUrl(githubAppSlug);
  const [manualId, setManualId] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualId.trim();
    if (!trimmed) {
      return;
    }

    setSubmittingManual(true);
    window.location.href = buildGitHubInstallCallbackUrl(publicApiUrl, trimmed);
  }, [manualId]);

  return (
    <>
      <div className="pw-onboarding-card-header">
        <h1 className="pw-onboarding-card-title">Install the GitHub App</h1>
        <p className="pw-onboarding-card-subtitle">
          PipeWatch needs read access to your GitHub Actions data.
        </p>
      </div>

      <div className="pw-onboarding-card-body">
        <div className="pw-onboarding-permissions">
          <div className="pw-onboarding-permissions-section">
            <h2 className="pw-onboarding-permissions-heading">Read access granted</h2>
            <ul className="pw-onboarding-permission-list">
              <li className="pw-onboarding-permission-item">
                <span
                  className="pw-onboarding-permission-icon pw-onboarding-permission-icon-granted"
                  aria-hidden
                >
                  <Check size={10} strokeWidth={2} />
                </span>
                <div>
                  <div className="pw-onboarding-permission-title">Actions</div>
                  <div className="pw-onboarding-permission-desc">
                    Workflow runs, jobs, steps, and timing data
                  </div>
                  <div className="pw-onboarding-permission-desc pw-onboarding-permission-desc-muted">
                    Events: workflow_run, workflow_job
                  </div>
                </div>
              </li>
              <li className="pw-onboarding-permission-item">
                <span
                  className="pw-onboarding-permission-icon pw-onboarding-permission-icon-granted"
                  aria-hidden
                >
                  <Check size={10} strokeWidth={2} />
                </span>
                <div>
                  <div className="pw-onboarding-permission-title">Metadata</div>
                  <div className="pw-onboarding-permission-desc">
                    Repository names, visibility, and branch info
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div className="pw-onboarding-permissions-section">
            <h2 className="pw-onboarding-permissions-heading">Never requested</h2>
            <ul className="pw-onboarding-permission-list">
              <li className="pw-onboarding-permission-item">
                <span
                  className="pw-onboarding-permission-icon pw-onboarding-permission-icon-denied"
                  aria-hidden
                >
                  <Minus size={9} strokeWidth={2} />
                </span>
                <div>
                  <div className="pw-onboarding-permission-title">No write access</div>
                  <div className="pw-onboarding-permission-desc pw-onboarding-permission-desc-muted">
                    PipeWatch cannot trigger, cancel, or modify runs
                  </div>
                </div>
              </li>
              <li className="pw-onboarding-permission-item">
                <span
                  className="pw-onboarding-permission-icon pw-onboarding-permission-icon-denied"
                  aria-hidden
                >
                  <Minus size={9} strokeWidth={2} />
                </span>
                <div>
                  <div className="pw-onboarding-permission-title">No access to your code</div>
                  <div className="pw-onboarding-permission-desc pw-onboarding-permission-desc-muted">
                    File contents, commits, and pull requests are not readable
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: "var(--space-5)" }}>
          <Button
            className="pw-onboarding-install-btn"
            style={{ width: "100%" }}
            onClick={() => {
              window.open(installUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <Github size={16} strokeWidth={2} aria-hidden />
            Install GitHub App →
          </Button>
        </div>

        {flags.IS_CE ? (
          <div className="pw-onboarding-manual">
            <p className="pw-onboarding-manual-label">
              Already installed? Enter your installation ID manually.
            </p>
            <div className="pw-onboarding-manual-row">
              <Input
                value={manualId}
                onChange={(event) => {
                  setManualId(event.target.value);
                }}
                placeholder="12345678"
                mono
                aria-label="GitHub installation ID"
              />
              <Button
                variant="secondary"
                disabled={!manualId.trim() || submittingManual}
                onClick={handleManualSubmit}
              >
                Connect
              </Button>
            </div>
          </div>
        ) : null}
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
          <Button
            variant="secondary"
            onClick={() => {
              window.open(installUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Open install page
          </Button>
        </div>
      </div>
    </>
  );
}

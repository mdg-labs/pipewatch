"use client";

import { flags } from "@pipewatch/config/edition";
import { Check, Github, Minus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("onboarding.installGithub");
  const tCommon = useTranslations("onboarding.common");
  const installUrl = buildGitHubAppInstallUrl(githubAppSlug);
  const installConfigured = installUrl !== null;
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
        <h1 className="pw-onboarding-card-title">{t("title")}</h1>
        <p className="pw-onboarding-card-subtitle">{t("subtitle")}</p>
      </div>

      <div className="pw-onboarding-card-body">
        <div className="pw-onboarding-permissions">
          <div className="pw-onboarding-permissions-section">
            <h2 className="pw-onboarding-permissions-heading">{t("readAccessHeading")}</h2>
            <ul className="pw-onboarding-permission-list">
              <li className="pw-onboarding-permission-item">
                <span
                  className="pw-onboarding-permission-icon pw-onboarding-permission-icon-granted"
                  aria-hidden
                >
                  <Check size={10} strokeWidth={2} />
                </span>
                <div>
                  <div className="pw-onboarding-permission-title">{t("actionsTitle")}</div>
                  <div className="pw-onboarding-permission-desc">
                    {t("actionsDescription")}
                  </div>
                  <div className="pw-onboarding-permission-desc pw-onboarding-permission-desc-muted">
                    {t("actionsEvents")}
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
                  <div className="pw-onboarding-permission-title">{t("metadataTitle")}</div>
                  <div className="pw-onboarding-permission-desc">
                    {t("metadataDescription")}
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div className="pw-onboarding-permissions-section">
            <h2 className="pw-onboarding-permissions-heading">{t("neverRequestedHeading")}</h2>
            <ul className="pw-onboarding-permission-list">
              <li className="pw-onboarding-permission-item">
                <span
                  className="pw-onboarding-permission-icon pw-onboarding-permission-icon-denied"
                  aria-hidden
                >
                  <Minus size={9} strokeWidth={2} />
                </span>
                <div>
                  <div className="pw-onboarding-permission-title">{t("noWriteTitle")}</div>
                  <div className="pw-onboarding-permission-desc pw-onboarding-permission-desc-muted">
                    {t("noWriteDescription")}
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
                  <div className="pw-onboarding-permission-title">{t("noCodeTitle")}</div>
                  <div className="pw-onboarding-permission-desc pw-onboarding-permission-desc-muted">
                    {t("noCodeDescription")}
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: "var(--space-5)" }}>
          {installConfigured ? null : (
            <p className="pw-onboarding-card-subtitle" role="alert">
              {t("notConfigured")}
            </p>
          )}
          <Button
            className="pw-onboarding-install-btn"
            style={{ width: "100%" }}
            disabled={!installConfigured}
            onClick={() => {
              if (installUrl) {
                window.open(installUrl, "_blank", "noopener,noreferrer");
              }
            }}
          >
            <Github size={16} strokeWidth={2} aria-hidden />
            {t("installButton")}
          </Button>
        </div>

        {flags.IS_CE ? (
          <div className="pw-onboarding-manual">
            <p className="pw-onboarding-manual-label">{t("manualLabel")}</p>
            <div className="pw-onboarding-manual-row">
              <Input
                value={manualId}
                onChange={(event) => {
                  setManualId(event.target.value);
                }}
                placeholder="12345678"
                mono
                aria-label={t("installationIdAriaLabel")}
              />
              <Button
                variant="secondary"
                disabled={!manualId.trim() || submittingManual}
                onClick={handleManualSubmit}
              >
                {t("connect")}
              </Button>
            </div>
          </div>
        ) : null}
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
          <Button
            variant="secondary"
            disabled={!installConfigured}
            onClick={() => {
              if (installUrl) {
                window.open(installUrl, "_blank", "noopener,noreferrer");
              }
            }}
          >
            {t("openInstallPage")}
          </Button>
        </div>
      </div>
    </>
  );
}

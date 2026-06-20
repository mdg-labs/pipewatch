"use client";

import { Github } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, LogoWordmark } from "@pipewatch/ui";

import { CUSTOMER_DOCS_URL } from "@/lib/customer-docs";

import "./bootstrap.css";

export type BootstrapCardProps = {
  oauthUrl: string;
  marketingUrl: string;
};

/** Centered CE bootstrap card — first-run GitHub OAuth (pages B0). */
export function BootstrapCard({ oauthUrl, marketingUrl }: BootstrapCardProps) {
  const t = useTranslations("auth.bootstrap");
  const tCommon = useTranslations("auth.common");

  return (
    <>
      <div className="pw-bootstrap-shell">
        <div className="pw-bootstrap-brand">
          <LogoWordmark markSize={40} />
          <span className="pw-bootstrap-ce-badge">{t("ceBadge")}</span>
        </div>

        <Card className="pw-bootstrap-card">
          <div className="pw-bootstrap-fresh-install" role="status">
            <span className="pw-bootstrap-fresh-install-dot" aria-hidden />
            {t("freshInstall")}
          </div>

          <h1 className="pw-bootstrap-heading">{t("heading")}</h1>
          <p className="pw-bootstrap-subtext">{t("subtext")}</p>

          <a className="pw-bootstrap-oauth" href={oauthUrl}>
            <Github size={18} strokeWidth={2} aria-hidden />
            {t("signInWithGithub")}
          </a>

          <div className="pw-bootstrap-info">
            <p className="pw-bootstrap-info-text">
              {t.rich("infoText", {
                settings: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>
        </Card>

        <div className="pw-bootstrap-help">
          <a
            className="pw-bootstrap-help-link"
            href={CUSTOMER_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("helpLink")}
          </a>
        </div>
      </div>

      <footer className="pw-bootstrap-legal">
        <a className="pw-bootstrap-legal-link" href={`${marketingUrl}/privacy`}>
          {tCommon("privacy")}
        </a>
        <a className="pw-bootstrap-legal-link" href={`${marketingUrl}/terms`}>
          {tCommon("terms")}
        </a>
      </footer>
    </>
  );
}

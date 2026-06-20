"use client";

import { ChevronLeft, Github } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, LogoWordmark } from "@pipewatch/ui";

import "./sign-in.css";

export type SignInCardProps = {
  oauthUrl: string;
  marketingUrl: string;
};

/** Centered sign-in card — GitHub OAuth CTA and marketing link (pages B1). */
export function SignInCard({ oauthUrl, marketingUrl }: SignInCardProps) {
  const t = useTranslations("auth.signIn");
  const tCommon = useTranslations("auth.common");

  return (
    <>
      <div className="pw-sign-in-shell">
        <div className="pw-sign-in-brand">
          <LogoWordmark markSize={40} />
        </div>

        <Card className="pw-sign-in-card">
          <h1 className="pw-sign-in-heading">{t("heading")}</h1>
          <p className="pw-sign-in-subtext">{t("subtext")}</p>

          <a className="pw-sign-in-oauth" href={oauthUrl}>
            <Github size={18} strokeWidth={2} aria-hidden />
            {t("continueWithGithub")}
          </a>

          <div className="pw-sign-in-divider">
            <div className="pw-sign-in-divider-line" aria-hidden />
            <span className="pw-sign-in-divider-label">{t("dividerLabel")}</span>
            <div className="pw-sign-in-divider-line" aria-hidden />
          </div>

          <p className="pw-sign-in-footnote">{t("footnote")}</p>
        </Card>

        <div className="pw-sign-in-marketing">
          <a className="pw-sign-in-marketing-link" href={marketingUrl}>
            <ChevronLeft size={12} strokeWidth={1.5} aria-hidden />
            {t("backToMarketing")}
          </a>
        </div>
      </div>

      <footer className="pw-sign-in-legal">
        <a className="pw-sign-in-legal-link" href={`${marketingUrl}/privacy`}>
          {tCommon("privacy")}
        </a>
        <a className="pw-sign-in-legal-link" href={`${marketingUrl}/terms`}>
          {tCommon("terms")}
        </a>
      </footer>
    </>
  );
}

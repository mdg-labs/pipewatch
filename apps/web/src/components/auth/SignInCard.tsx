"use client";

import { ChevronLeft, Github } from "lucide-react";

import { Card, LogoWordmark } from "@pipewatch/ui";

import "./sign-in.css";

export type SignInCardProps = {
  oauthUrl: string;
  marketingUrl: string;
};

/** Centered sign-in card — GitHub OAuth CTA and marketing link (pages B1). */
export function SignInCard({ oauthUrl, marketingUrl }: SignInCardProps) {
  return (
    <>
      <div className="pw-sign-in-shell">
        <div className="pw-sign-in-brand">
          <LogoWordmark markSize={40} />
        </div>

        <Card className="pw-sign-in-card">
          <h1 className="pw-sign-in-heading">Sign in to PipeWatch</h1>
          <p className="pw-sign-in-subtext">Your GitHub account is all you need.</p>

          <a className="pw-sign-in-oauth" href={oauthUrl}>
            <Github size={18} strokeWidth={2} aria-hidden />
            Continue with GitHub
          </a>

          <div className="pw-sign-in-divider">
            <div className="pw-sign-in-divider-line" aria-hidden />
            <span className="pw-sign-in-divider-label">first time?</span>
            <div className="pw-sign-in-divider-line" aria-hidden />
          </div>

          <p className="pw-sign-in-footnote">
            Don&apos;t have an account? Signing in creates one.
          </p>
        </Card>

        <div className="pw-sign-in-marketing">
          <a className="pw-sign-in-marketing-link" href={marketingUrl}>
            <ChevronLeft size={12} strokeWidth={1.5} aria-hidden />
            Back to pipewatch.app
          </a>
        </div>
      </div>

      <footer className="pw-sign-in-legal">
        <a className="pw-sign-in-legal-link" href={`${marketingUrl}/privacy`}>
          Privacy
        </a>
        <a className="pw-sign-in-legal-link" href={`${marketingUrl}/terms`}>
          Terms
        </a>
      </footer>
    </>
  );
}

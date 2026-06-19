"use client";

import { Github } from "lucide-react";

import { Card, LogoWordmark } from "@pipewatch/ui";

import { CUSTOMER_DOCS_URL } from "@/lib/customer-docs";

import "./bootstrap.css";

export type BootstrapCardProps = {
  oauthUrl: string;
  marketingUrl: string;
};

/** Centered CE bootstrap card — first-run GitHub OAuth (pages B0). */
export function BootstrapCard({ oauthUrl, marketingUrl }: BootstrapCardProps) {
  return (
    <>
      <div className="pw-bootstrap-shell">
        <div className="pw-bootstrap-brand">
          <LogoWordmark markSize={40} />
          <span className="pw-bootstrap-ce-badge">Community Edition</span>
        </div>

        <Card className="pw-bootstrap-card">
          <div className="pw-bootstrap-fresh-install" role="status">
            <span className="pw-bootstrap-fresh-install-dot" aria-hidden />
            Fresh install detected — no users yet
          </div>

          <h1 className="pw-bootstrap-heading">Welcome to PipeWatch CE</h1>
          <p className="pw-bootstrap-subtext">
            You&apos;re the first user. Sign in with GitHub to create your admin account.
            You&apos;ll have full owner access to this instance.
          </p>

          <a className="pw-bootstrap-oauth" href={oauthUrl}>
            <Github size={18} strokeWidth={2} aria-hidden />
            Sign in with GitHub
          </a>

          <div className="pw-bootstrap-info">
            <p className="pw-bootstrap-info-text">
              This screen disappears after your account is created. Additional users can be
              invited from <strong>Settings → Members</strong>.
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
            Need help? Read the CE setup guide →
          </a>
        </div>
      </div>

      <footer className="pw-bootstrap-legal">
        <a className="pw-bootstrap-legal-link" href={`${marketingUrl}/privacy`}>
          Privacy
        </a>
        <a className="pw-bootstrap-legal-link" href={`${marketingUrl}/terms`}>
          Terms
        </a>
      </footer>
    </>
  );
}

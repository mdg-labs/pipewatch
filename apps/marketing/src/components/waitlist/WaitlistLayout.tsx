import Link from "next/link";
import type { ReactNode } from "react";

import { LogoWordmark } from "@pipewatch/ui/components/logo-wordmark";

import "./waitlist.css";

type WaitlistLayoutProps = {
  title: string;
  subtitle: string;
  timeline?: string | undefined;
  statusIcon?: ReactNode;
  children?: ReactNode;
};

export function WaitlistLayout({
  title,
  subtitle,
  timeline,
  statusIcon,
  children,
}: WaitlistLayoutProps) {
  return (
    <div className="waitlist-page">
      <div className="waitlist-shell">
        <div className="waitlist-brand">
          <LogoWordmark markSize={40} />
        </div>

        <div className="waitlist-card">
          {statusIcon ? (
            <div className="waitlist-status-icon">{statusIcon}</div>
          ) : null}
          <h1 className="waitlist-card-title">{title}</h1>
          <p className="waitlist-card-subtitle">{subtitle}</p>
          {timeline ? <p className="waitlist-timeline">{timeline}</p> : null}
          {children}
        </div>

        <Link href="/" className="waitlist-back-link">
          ← Back to pipewatch.app
        </Link>
      </div>
    </div>
  );
}

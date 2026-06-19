import Link from "next/link";

import { buttonClassName } from "@pipewatch/ui/components/button";
import { LogoWordmark } from "@pipewatch/ui/components/logo-wordmark";

import { getGitHubStarCount } from "@/lib/github-stars";
import {
  GITHUB_REPO_URL,
  getMarketingCta,
  getSignInUrl,
  marketingNavLinks,
} from "@/lib/marketing-links";

import "./marketing-layout.css";

function GitHubStarIcon() {
  return (
    <svg
      className="marketing-github-stars-icon"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

export async function MarketingNav() {
  const starCount = await getGitHubStarCount();
  const cta = getMarketingCta();

  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <Link href="/" className="marketing-logo-link">
          <LogoWordmark markSize={22} />
        </Link>

        <nav className="marketing-nav" aria-label="Primary">
          {marketingNavLinks.map((link) =>
            "external" in link && link.external ? (
              <a
                key={link.href}
                href={link.href}
                className="marketing-nav-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="marketing-nav-link">
                {link.label}
              </Link>
            ),
          )}

          <a
            href={GITHUB_REPO_URL}
            className="marketing-github-stars"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubStarIcon />
            {starCount !== null ? (
              <span>{starCount.toLocaleString("en-US")}</span>
            ) : (
              <span>GitHub</span>
            )}
          </a>
        </nav>

        <div className="marketing-header-actions">
          <a href={getSignInUrl()} className="marketing-sign-in-link">
            Sign in
          </a>
          <Link
            href={cta.href}
            className={buttonClassName({ variant: "primary", size: "sm" })}
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </header>
  );
}

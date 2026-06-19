import Link from "next/link";

import { flags } from "@pipewatch/config/edition";
import { Logo } from "@pipewatch/ui/components/logo";

import {
  GITHUB_REPO_URL,
  MDG_LABS_GITHUB_URL,
  marketingFooterLegalLinks,
  marketingFooterProductLinks,
} from "@/lib/marketing-links";

import "./marketing-layout.css";

export function MarketingFooter() {
  const productLinks = marketingFooterProductLinks.filter(
    (link) => link.href !== "/waitlist" || flags.WAITLIST_ENABLED,
  );

  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-inner">
        <div className="marketing-footer-brand">
          <Logo size={16} aria-hidden />
          <span className="marketing-footer-brand-name">PipeWatch</span>
          <span className="marketing-footer-brand-byline">by MDG Labs</span>
        </div>

        <div className="marketing-footer-links">
          {productLinks.map((link) =>
            "external" in link && link.external ? (
              <a
                key={link.href}
                href={link.href}
                className="marketing-footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="marketing-footer-link">
                {link.label}
              </Link>
            ),
          )}

          {marketingFooterLegalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="marketing-footer-link">
              {link.label}
            </Link>
          ))}

          <a
            href={GITHUB_REPO_URL}
            className="marketing-footer-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>

          <a
            href={MDG_LABS_GITHUB_URL}
            className="marketing-footer-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            MDG Labs
          </a>
        </div>
      </div>
    </footer>
  );
}

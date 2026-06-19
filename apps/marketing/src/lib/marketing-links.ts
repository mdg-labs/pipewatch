import { flags } from "@pipewatch/config/edition";

import { getAppUrl, isWaitlistMode } from "./env";

export const GITHUB_REPO_URL = "https://github.com/mdg-labs/pipewatch";
export const MDG_LABS_GITHUB_URL = "https://github.com/mdg-labs";
export const CUSTOMER_DOCS_URL = "https://docs.pipewatch.app";

export const marketingNavLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: CUSTOMER_DOCS_URL, label: "Docs", external: true },
  { href: "/changelog", label: "Changelog" },
] as const;

export const marketingFooterProductLinks = [
  ...marketingNavLinks,
  { href: "/waitlist", label: "Waitlist" },
] as const;

export const marketingFooterLegalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export function getSignInUrl(): string {
  return `${getAppUrl()}/sign-in`;
}

export function getMarketingCta(): { href: string; label: string } {
  if (isWaitlistMode() && flags.WAITLIST_ENABLED) {
    return { href: "/waitlist", label: "Join waitlist" };
  }
  return { href: getSignInUrl(), label: "Get started" };
}

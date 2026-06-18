import { parseMarketingEnv } from "@pipewatch/config/env";

/** Validated marketing env — fails fast via instrumentation at startup. */
export function getMarketingEnv() {
  return parseMarketingEnv();
}

/** Cloud app origin for Sign in / Get started links. */
export function getAppUrl(): string {
  const raw = getMarketingEnv().NEXT_PUBLIC_APP_URL;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3001";
}

export function isWaitlistMode(): boolean {
  return getMarketingEnv().LAUNCH_MODE === "waitlist";
}

export function getUmamiConfig(): {
  scriptUrl: string;
  websiteId: string;
} | null {
  const env = getMarketingEnv();
  if (!env.UMAMI_SCRIPT_URL || !env.UMAMI_WEBSITE_ID) {
    return null;
  }
  return {
    scriptUrl: env.UMAMI_SCRIPT_URL,
    websiteId: env.UMAMI_WEBSITE_ID,
  };
}

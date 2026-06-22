import { getMarketingEnv } from "./env";

const DEFAULT_API_URL = "http://localhost:3001";

/** Public API origin for waitlist calls (PRD §14). */
export function getApiUrl(): string {
  const appUrl = getMarketingEnv().PUBLIC_APP_URL;
  if (!appUrl) {
    return DEFAULT_API_URL;
  }

  const trimmed = appUrl.replace(/\/$/, "");
  if (trimmed.includes("://cloud.")) {
    return trimmed.replace("://cloud.", "://api.");
  }
  if (trimmed.includes("://staging-cloud.")) {
    return trimmed.replace("://staging-cloud.", "://staging-api.");
  }
  if (trimmed.includes("localhost:3000")) {
    return trimmed.replace(":3000", ":3001");
  }

  return DEFAULT_API_URL;
}

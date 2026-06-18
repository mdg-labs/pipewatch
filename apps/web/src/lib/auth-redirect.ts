/** Default marketing site URL when no web env override exists (pages B1). */
export const DEFAULT_MARKETING_SITE_URL = "https://pipewatch.app";

/** True when `next` is a same-origin relative path (no open redirect). */
export function isSafeNextPath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//");
}

/** Parse and validate the optional `?next=` redirect target. */
export function parseNextParam(next: string | string[] | undefined): string | undefined {
  if (typeof next !== "string" || next.length === 0) {
    return undefined;
  }

  return isSafeNextPath(next) ? next : undefined;
}

/** Build the API GitHub OAuth initiate URL, forwarding a safe `?next=` when present. */
export function buildGitHubOAuthUrl(apiUrl: string, next?: string | string[]): string {
  const base = apiUrl.replace(/\/$/, "");
  const url = new URL(`${base}/auth/github`);
  const safeNext = parseNextParam(next);

  if (safeNext) {
    url.searchParams.set("next", safeNext);
  }

  return url.toString();
}

/** Marketing site link for auth landing pages (pages B1). */
export function getMarketingSiteUrl(): string {
  return DEFAULT_MARKETING_SITE_URL;
}

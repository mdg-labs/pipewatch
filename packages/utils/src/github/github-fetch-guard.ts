/** Hosts permitted for outbound GitHub HTTP (SSRF guard — PRD §15). */
export const GITHUB_ALLOWED_HOSTS = ["api.github.com", "github.com"] as const;

export class GitHubFetchGuardError extends Error {
  readonly code = "GITHUB_FETCH_HOST_NOT_ALLOWED" as const;

  constructor(message: string) {
    super(message);
    this.name = "GitHubFetchGuardError";
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 10;

type FetchInput = string | URL | Request;

function resolveRequestUrl(input: FetchInput): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

/** Reject URLs whose host is outside the GitHub allowlist. */
export function assertGitHubAllowedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new GitHubFetchGuardError(`Invalid GitHub fetch URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new GitHubFetchGuardError(`GitHub fetch must use HTTPS: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    !GITHUB_ALLOWED_HOSTS.includes(
      hostname as (typeof GITHUB_ALLOWED_HOSTS)[number],
    )
  ) {
    throw new GitHubFetchGuardError(`GitHub fetch host not allowed: ${hostname}`);
  }
}

/**
 * Wrap `fetch` so every request and redirect target stays on the GitHub allowlist.
 * Uses manual redirect handling to block chains to non-allowlisted hosts.
 */
export function createGuardedGitHubFetch(
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (
    input: FetchInput,
    init?: RequestInit,
  ): Promise<Response> => {
    const startUrl = resolveRequestUrl(input);
    assertGitHubAllowedUrl(startUrl);

    const mergedInit: RequestInit = { ...init, redirect: "manual" };
    let currentUrl = startUrl;
    let response = await fetchImpl(currentUrl, mergedInit);

    let redirects = 0;
    while (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return response;
      }

      const nextUrl = new URL(location, currentUrl).href;
      assertGitHubAllowedUrl(nextUrl);

      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        throw new GitHubFetchGuardError(
          "GitHub fetch exceeded maximum redirects",
        );
      }

      currentUrl = nextUrl;
      response = await fetchImpl(currentUrl, mergedInit);
    }

    return response;
  };
}

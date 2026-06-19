import type { Db } from "@pipewatch/db";
import {
  createGuardedGitHubFetch,
  GitHubFetchGuardError,
} from "@pipewatch/utils";

import {
  type GitHubAppConfig,
  type IntegrationRecord,
  GitHubAppAuthError,
  ensureInstallationToken,
} from "./app-auth.js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 1_000;

export class GitHubFetchError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GitHubFetchError";
    this.status = status;
    this.code = code;
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

export type GitHubFetchDeps = {
  database: Db;
  config: GitHubAppConfig;
  integration: IntegrationRecord;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) {
      return seconds * 1_000;
    }

    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
  }

  const reset = response.headers.get("x-ratelimit-reset");
  if (reset) {
    const resetMs = Number(reset) * 1_000;
    if (!Number.isNaN(resetMs)) {
      return Math.max(0, resetMs - Date.now() + 1_000);
    }
  }

  return 60_000;
}

function isRateLimited(response: Response): boolean {
  if (response.status === 429) {
    return true;
  }

  if (response.status !== 403) {
    return false;
  }

  if (response.headers.get("x-ratelimit-remaining") === "0") {
    return true;
  }

  return response.headers.has("retry-after");
}

function githubRequestHeaders(token: string, init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  return headers;
}

/**
 * Rate-limit aware GitHub REST fetch — lazy token refresh and exponential backoff.
 */
export async function githubFetch(
  url: string,
  init: RequestInit | undefined,
  deps: GitHubFetchDeps,
): Promise<Response> {
  const fetchImpl = createGuardedGitHubFetch(deps.fetchImpl ?? fetch);
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;

  let token: string;
  try {
    token = await ensureInstallationToken(
      deps.database,
      deps.integration,
      deps.config,
      fetchImpl,
    );
  } catch (error) {
    if (error instanceof GitHubFetchGuardError) {
      throw new GitHubFetchError(error.message, 400, error.code);
    }
    if (error instanceof GitHubAppAuthError) {
      throw new GitHubFetchError(error.message, error.status, error.code);
    }
    throw error;
  }

  let attempt = 0;
  let backoffMs = DEFAULT_BACKOFF_MS;

  while (true) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: githubRequestHeaders(token, init),
      });
    } catch (error) {
      if (error instanceof GitHubFetchGuardError) {
        throw new GitHubFetchError(error.message, 400, error.code);
      }
      throw error;
    }

    if (!isRateLimited(response) || attempt >= maxRetries) {
      return response;
    }

    const retryAfterMs = parseRetryAfterMs(response);
    await sleep(Math.max(retryAfterMs, backoffMs));
    attempt += 1;
    backoffMs *= 2;
  }
}

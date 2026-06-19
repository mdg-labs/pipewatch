import type { ApiError } from "@pipewatch/types";

import {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "./auth";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = error.code;
  }
}

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip the automatic refresh-and-retry flow for this request. */
  skipAuthRetry?: boolean;
};

export type ApiClientConfig = {
  apiUrl: string;
  fetchImpl?: typeof fetch;
  /**
   * Called after a successful refresh when the new JWT is only available via
   * httpOnly cookie (browser). Typically triggers `router.refresh()` so the
   * server layout can re-seed the in-memory token.
   */
  onAuthRefreshed?: () => void | Promise<void>;
};

export type ApiClient = {
  fetch: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
  get: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: ApiRequestInit) => Promise<T>;
  patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) => Promise<T>;
  delete: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
  workspace: (workspaceId: string) => WorkspaceScopedClient;
};

export type WorkspaceScopedClient = {
  fetch: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
  get: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: ApiRequestInit) => Promise<T>;
  patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) => Promise<T>;
  delete: <T>(path: string, init?: ApiRequestInit) => Promise<T>;
};

function normalizeApiPath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }

  return path;
}

function buildApiUrl(apiUrl: string, path: string): string {
  const base = apiUrl.replace(/\/$/, "");
  const normalized = normalizeApiPath(path);
  return `${base}/api/v1${normalized}`;
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

async function parseApiError(response: Response): Promise<ApiClientError> {
  if (isJsonResponse(response)) {
    try {
      const body = (await response.json()) as { error?: ApiError };
      if (body.error?.code && body.error.message) {
        return new ApiClientError(response.status, body.error);
      }
    } catch {
      // Fall through to generic error.
    }
  }

  return new ApiClientError(response.status, {
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
  });
}

function buildRequestInit(init: ApiRequestInit | undefined): RequestInit {
  if (!init) {
    return {};
  }

  const { body, skipAuthRetry: _skipAuthRetry, headers, ...rest } = init;
  void _skipAuthRetry;

  if (body === undefined) {
    return {
      ...rest,
      ...(headers ? { headers } : {}),
    };
  }

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  return {
    ...rest,
    headers: requestHeaders,
    body: JSON.stringify(body),
  };
}

/** Create a typed fetch client for `/api/v1` with JWT auth and refresh retry. */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchFn = config.fetchImpl ?? fetch;
  let refreshInFlight: Promise<boolean> | null = null;

  async function ensureRefreshed(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const result = await refreshAccessToken({
          apiUrl: config.apiUrl,
          fetchImpl: fetchFn,
        });

        if (result.accessToken) {
          return true;
        }

        if (result.ok) {
          await config.onAuthRefreshed?.();
          return getAccessToken() !== null;
        }

        return false;
      })().finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  async function apiFetch<T>(
    path: string,
    init?: ApiRequestInit,
    hasRetried = false,
  ): Promise<T> {
    const requestInit = buildRequestInit(init);
    const headers = new Headers(requestInit.headers);
    const token = getAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetchFn(buildApiUrl(config.apiUrl, path), {
      ...requestInit,
      headers,
      credentials: "include",
    });

    if (
      response.status === 401 &&
      !init?.skipAuthRetry &&
      !hasRetried
    ) {
      const refreshed = await ensureRefreshed();
      if (refreshed) {
        return apiFetch<T>(path, init, true);
      }
    }

    if (!response.ok) {
      throw await parseApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (!isJsonResponse(response)) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  function createScopedClient(workspaceId: string): WorkspaceScopedClient {
    const prefix = `/workspaces/${workspaceId}`;

    return {
      fetch: <T>(path: string, init?: ApiRequestInit) =>
        apiFetch<T>(`${prefix}${normalizeApiPath(path)}`, init),
      get: <T>(path: string, init?: ApiRequestInit) =>
        apiFetch<T>(`${prefix}${normalizeApiPath(path)}`, { ...init, method: "GET" }),
      post: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
        apiFetch<T>(`${prefix}${normalizeApiPath(path)}`, {
          ...init,
          method: "POST",
          body,
        }),
      patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
        apiFetch<T>(`${prefix}${normalizeApiPath(path)}`, {
          ...init,
          method: "PATCH",
          body,
        }),
      delete: <T>(path: string, init?: ApiRequestInit) =>
        apiFetch<T>(`${prefix}${normalizeApiPath(path)}`, { ...init, method: "DELETE" }),
    };
  }

  return {
    fetch: apiFetch,
    get: <T>(path: string, init?: ApiRequestInit) =>
      apiFetch<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
      apiFetch<T>(path, { ...init, method: "POST", body }),
    patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
      apiFetch<T>(path, { ...init, method: "PATCH", body }),
    delete: <T>(path: string, init?: ApiRequestInit) =>
      apiFetch<T>(path, { ...init, method: "DELETE" }),
    workspace: createScopedClient,
  };
}

/** Seed the in-memory token (e.g. from a server-read httpOnly cookie). */
export { setAccessToken };

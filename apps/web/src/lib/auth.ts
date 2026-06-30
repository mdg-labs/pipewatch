import type { AccessTokenClaims, WorkspaceListItem } from "@pipewatch/types";

import { ACCESS_COOKIE_NAME } from "./auth-cookies";

/** In-memory access JWT for `Authorization: Bearer` (PRD §7.1). */
let accessToken: string | null = null;

/** Store the current access JWT in memory. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Read the in-memory access JWT, if any. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Clear the in-memory access JWT. */
export function clearAccessToken(): void {
  accessToken = null;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
}

/** Decode access JWT payload without signature verification (client display/context only). */
export function decodeAccessTokenClaims(token: string): AccessTokenClaims | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(segments[1]!)) as {
      sub?: unknown;
      workspaceId?: unknown;
      role?: unknown;
      iat?: unknown;
      exp?: unknown;
    };

    if (typeof payload.sub !== "string") {
      return null;
    }

    const workspaceId =
      typeof payload.workspaceId === "string" ? payload.workspaceId : undefined;
    const role =
      payload.role === "owner" || payload.role === "admin" || payload.role === "member"
        ? payload.role
        : undefined;

    return {
      sub: payload.sub,
      ...(workspaceId !== undefined ? { workspaceId } : {}),
      ...(role !== undefined ? { role } : {}),
      iat: typeof payload.iat === "number" ? payload.iat : 0,
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}

/** Claims from the in-memory access token, when present. */
export function getAccessTokenClaims(): AccessTokenClaims | null {
  const token = getAccessToken();
  return token ? decodeAccessTokenClaims(token) : null;
}

/** True when the token is missing or past expiry (with optional clock skew). */
export function isAccessTokenExpired(
  claims: AccessTokenClaims,
  skewSeconds = 30,
): boolean {
  if (!claims.exp) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return claims.exp <= nowSeconds + skewSeconds;
}

/** Extract `pw_access` from a `Set-Cookie` header value (Node/test fetch). */
export function parseAccessTokenFromSetCookie(
  setCookie: string | null | readonly string[],
): string | null {
  const headers = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];

  for (const header of headers) {
    const match = header.match(/(?:^|,\s*)pw_access=([^;]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function readSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

export type RefreshAccessTokenOptions = {
  apiUrl: string;
  fetchImpl?: typeof fetch;
};

export type RefreshAccessTokenResult = {
  ok: boolean;
  accessToken?: string;
};

/**
 * Single-flight guard: the API rotates the refresh token on every refresh and
 * treats reuse of a revoked token as account takeover (revokes ALL user tokens).
 * Concurrent refreshes with the same cookie would trip that detection and log
 * the user out, so all callers share one in-flight request (PRD §7.1).
 */
let refreshInFlight: Promise<RefreshAccessTokenResult> | null = null;

async function performRefresh(
  options: RefreshAccessTokenOptions,
): Promise<RefreshAccessTokenResult> {
  const fetchFn = options.fetchImpl ?? fetch;
  const response = await fetchFn(`${options.apiUrl.replace(/\/$/, "")}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    return { ok: false };
  }

  const token = parseAccessTokenFromSetCookie(readSetCookieHeaders(response));
  if (token) {
    setAccessToken(token);
    return { ok: true, accessToken: token };
  }

  return { ok: true };
}

/**
 * Rotate refresh token and issue a new access JWT via `POST /auth/refresh`.
 * Updates in-memory token when the response exposes `pw_access` (server/test fetch).
 * Concurrent calls are de-duplicated to a single network request.
 */
export async function refreshAccessToken(
  options: RefreshAccessTokenOptions,
): Promise<RefreshAccessTokenResult> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = performRefresh(options).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Resolve workspace ID from route slug using a workspace list or JWT claims.
 * Path routes use slugs; API routes use workspace IDs (PRD §7).
 *
 * Claims are passed in (not read from the module store) so resolution stays
 * reactive to the seeded access token in React components.
 */
export function resolveWorkspaceId(
  slug: string | null | undefined,
  workspaces?: readonly WorkspaceListItem[],
  claims?: AccessTokenClaims | null,
): string | null {
  if (!slug) {
    return null;
  }

  const fromList = workspaces?.find((workspace) => workspace.slug === slug)?.id;
  if (fromList) {
    return fromList;
  }

  return claims?.workspaceId ?? null;
}

/** Cookie name for server-side bootstrap of the in-memory token. */
export { ACCESS_COOKIE_NAME };

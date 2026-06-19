import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";

import { resolveAuthCookieDomain } from "../../lib/cookie-domain.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
  verifyAccessTokenIgnoreExpiry,
} from "../../services/auth/jwt.js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  type RefreshCookieOptions,
  buildAuthCookieOptions,
} from "../../services/auth/refresh-token.js";
import { resolveAuthSession } from "../../services/auth/oauth.js";
import type { Db } from "@pipewatch/db";
import type { WorkspaceRole } from "@pipewatch/types";

/** SameSite for short-lived access JWT cookie — Lax allows post-OAuth redirect to app host. */
export const ACCESS_COOKIE_SAME_SITE = "Lax" as const;

/** SameSite for long-lived refresh token cookie (PRD §20). */
export const REFRESH_COOKIE_SAME_SITE = "Strict" as const;

export function resolveSecureCookies(env: ParsedApiEnv): boolean {
  return env.NODE_ENV !== "development";
}

export function requireJwtSecret(env: ParsedApiEnv): string {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwtSecret;
}

export function setAccessTokenCookie(
  c: Context,
  accessToken: string,
  secure: boolean,
  domain?: string,
): void {
  setCookie(c, ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure,
    sameSite: ACCESS_COOKIE_SAME_SITE,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
    ...(domain ? { domain } : {}),
  });
}

export function setRefreshTokenCookie(
  c: Context,
  refreshToken: string,
  options: RefreshCookieOptions,
  domain?: string,
): void {
  setCookie(c, REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: options.secure,
    sameSite: REFRESH_COOKIE_SAME_SITE,
    path: options.path,
    maxAge: options.maxAgeSeconds,
    ...(domain ? { domain } : {}),
  });
}

export function clearAuthCookies(c: Context, secure: boolean, domain?: string): void {
  setCookie(c, REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: REFRESH_COOKIE_SAME_SITE,
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });

  setCookie(c, ACCESS_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: ACCESS_COOKIE_SAME_SITE,
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}

/** Resolve workspace claims for JWT issuance, preserving switched workspace when possible. */
export async function resolveWorkspaceClaims(
  database: Db,
  userId: string,
  accessToken: string | undefined,
  jwtSecret: string,
): Promise<{ workspaceId?: string; role?: WorkspaceRole }> {
  if (accessToken) {
    try {
      const claims = await verifyAccessTokenIgnoreExpiry(accessToken, jwtSecret);
      if (claims.sub === userId && claims.workspaceId && claims.role) {
        return { workspaceId: claims.workspaceId, role: claims.role };
      }
    } catch {
      // Fall through to DB resolution.
    }
  }

  const session = await resolveAuthSession(database, userId, null);
  if (session.workspace && session.membershipRole) {
    return {
      workspaceId: session.workspace.id,
      role: session.membershipRole,
    };
  }

  return {};
}

export async function issueAccessTokenForUser(
  database: Db,
  userId: string,
  jwtSecret: string,
  accessCookie: string | undefined,
  workspaceOverride?: { workspaceId: string; role: WorkspaceRole },
): Promise<string> {
  const claims =
    workspaceOverride ??
    (await resolveWorkspaceClaims(database, userId, accessCookie, jwtSecret));

  return signAccessToken(
    {
      userId,
      ...(claims.workspaceId !== undefined ? { workspaceId: claims.workspaceId } : {}),
      ...(claims.role !== undefined ? { role: claims.role } : {}),
    },
    jwtSecret,
  );
}

export { buildAuthCookieOptions, getCookie, REFRESH_COOKIE_NAME, ACCESS_COOKIE_NAME, resolveAuthCookieDomain };

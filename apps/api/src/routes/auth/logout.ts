import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import { ApiErrorEnvelopeSchema } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  AuthError,
  REFRESH_COOKIE_NAME,
  requireActiveRefreshToken,
  revokeAllUserRefreshTokens,
  revokeRefreshTokenById,
} from "../../services/auth/refresh-token.js";
import type { ApiEnv } from "../../types.js";
import { clearAuthCookies, resolveAuthCookieDomain, resolveSecureCookies } from "./shared.js";

export type LogoutAuthDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

const logoutRoute = createRoute({
  method: "post",
  path: "/auth/logout",
  tags: [OpenApiTags.AUTH],
  summary: "Log out current session",
  description:
    "Revokes the refresh token from the httpOnly cookie and clears auth cookies. Requires a valid refresh cookie.",
  responses: {
    204: {
      description: "Session revoked",
    },
    401: {
      description: "Missing or invalid refresh token",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const logoutAllRoute = createRoute({
  method: "post",
  path: "/auth/logout-all",
  tags: [OpenApiTags.AUTH],
  summary: "Log out all sessions",
  description:
    "Revokes all refresh tokens for the authenticated user and clears auth cookies.",
  responses: {
    204: {
      description: "All sessions revoked",
    },
    401: {
      description: "Missing or invalid refresh token",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

function resolveDatabase(deps?: Partial<LogoutAuthDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

/** Register POST /auth/logout and POST /auth/logout-all (PRD §20). */
export function registerLogoutRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<LogoutAuthDependencies>,
): void {
  const resolveDeps = (): LogoutAuthDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
  });

  app.openapi(logoutRoute, async (c) => {
    const { env, db } = resolveDeps();
    const secure = resolveSecureCookies(env);
    const cookieDomain = resolveAuthCookieDomain(env);

    try {
      const refreshCookie = getCookie(c, REFRESH_COOKIE_NAME);
      const tokenRow = await requireActiveRefreshToken(db, refreshCookie);
      await revokeRefreshTokenById(db, tokenRow.id);
      clearAuthCookies(c, secure, cookieDomain);

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new HTTPException(error.status as 401, {
          message: error.message,
        });
      }

      throw error;
    }
  });

  app.openapi(logoutAllRoute, async (c) => {
    const { env, db } = resolveDeps();
    const secure = resolveSecureCookies(env);
    const cookieDomain = resolveAuthCookieDomain(env);

    try {
      const refreshCookie = getCookie(c, REFRESH_COOKIE_NAME);
      const tokenRow = await requireActiveRefreshToken(db, refreshCookie);
      await revokeAllUserRefreshTokens(db, tokenRow.userId);
      clearAuthCookies(c, secure, cookieDomain);

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new HTTPException(error.status as 401, {
          message: error.message,
        });
      }

      throw error;
    }
  });
}

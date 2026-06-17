import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import {
  AuthError,
  REFRESH_COOKIE_NAME,
  requireActiveRefreshToken,
  revokeAllUserRefreshTokens,
  revokeRefreshTokenById,
} from "../../services/auth/refresh-token.js";
import type { ApiEnv } from "../../types.js";
import { clearAuthCookies, resolveSecureCookies } from "./shared.js";

export type LogoutAuthDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

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

  app.post("/auth/logout", async (c) => {
    const { env, db } = resolveDeps();
    const secure = resolveSecureCookies(env);

    try {
      const refreshCookie = getCookie(c, REFRESH_COOKIE_NAME);
      const tokenRow = await requireActiveRefreshToken(db, refreshCookie);
      await revokeRefreshTokenById(db, tokenRow.id);
      clearAuthCookies(c, secure);

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

  app.post("/auth/logout-all", async (c) => {
    const { env, db } = resolveDeps();
    const secure = resolveSecureCookies(env);

    try {
      const refreshCookie = getCookie(c, REFRESH_COOKIE_NAME);
      const tokenRow = await requireActiveRefreshToken(db, refreshCookie);
      await revokeAllUserRefreshTokens(db, tokenRow.userId);
      clearAuthCookies(c, secure);

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

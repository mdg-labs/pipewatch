import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import {
  AuthError,
  REFRESH_COOKIE_NAME,
  buildAuthCookieOptions,
  requireActiveRefreshToken,
  rotateRefreshToken,
} from "../../services/auth/refresh-token.js";
import type { ApiEnv } from "../../types.js";
import {
  ACCESS_COOKIE_NAME,
  issueAccessTokenForUser,
  requireJwtSecret,
  resolveSecureCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "./shared.js";

export type RefreshAuthDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

function resolveDatabase(deps?: Partial<RefreshAuthDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

/** Register POST /auth/refresh — rotate refresh token and issue new access JWT (PRD §20). */
export function registerRefreshRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<RefreshAuthDependencies>,
): void {
  const resolveDeps = (): RefreshAuthDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
  });

  app.post("/auth/refresh", async (c) => {
    const { env, db } = resolveDeps();
    const secure = resolveSecureCookies(env);

    try {
      const jwtSecret = requireJwtSecret(env);
      const refreshCookie = getCookie(c, REFRESH_COOKIE_NAME);
      const accessCookie = getCookie(c, ACCESS_COOKIE_NAME);
      const tokenRow = await requireActiveRefreshToken(db, refreshCookie);

      const newRefreshToken = await rotateRefreshToken(
        db,
        tokenRow.userId,
        refreshCookie!,
      );

      const accessToken = await issueAccessTokenForUser(
        db,
        tokenRow.userId,
        jwtSecret,
        accessCookie,
      );

      const refreshCookieOptions = buildAuthCookieOptions(secure);
      setRefreshTokenCookie(c, newRefreshToken, refreshCookieOptions);
      setAccessTokenCookie(c, accessToken, secure);

      return c.body(null, 204);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new HTTPException(error.status as 401 | 503, {
          message: error.message,
        });
      }

      throw error;
    }
  });
}

import type { Db } from "@pipewatch/db";
import type { ApiKeyAuthIdentity } from "@pipewatch/types";
import { API_KEY_PREFIX } from "@pipewatch/types";
import type { MiddlewareHandler } from "hono";

import { authenticateApiKey } from "../services/auth/api-key.js";
import { apiError } from "./error-handler.js";
import type { ApiEnv } from "../types.js";

export const API_KEY_AUTH_IDENTITY_KEY = "apiKeyAuthIdentity";

export type ApiKeyAuthDeps = {
  db: Db;
};

export function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
  return match?.[1];
}

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

/** Extract a raw API key when the Authorization header uses `Bearer pw_<key>`. */
export function parseApiKeyBearer(authorizationHeader: string | undefined): string | undefined {
  const token = parseBearerToken(authorizationHeader);
  if (!token || !isApiKeyToken(token)) {
    return undefined;
  }

  return token;
}

export function getApiKeyAuthIdentity(c: {
  get: (key: typeof API_KEY_AUTH_IDENTITY_KEY) => ApiKeyAuthIdentity | undefined;
}): ApiKeyAuthIdentity | undefined {
  return c.get(API_KEY_AUTH_IDENTITY_KEY);
}

export function setApiKeyAuthIdentity(
  c: { set: (key: typeof API_KEY_AUTH_IDENTITY_KEY, value: ApiKeyAuthIdentity) => void },
  identity: ApiKeyAuthIdentity,
): void {
  c.set(API_KEY_AUTH_IDENTITY_KEY, identity);
}

/**
 * Resolve API key identity from an Authorization header.
 * Returns null when the header is missing, not an API key, or invalid.
 */
export async function resolveApiKeyAuthIdentity(
  database: Db,
  authorizationHeader: string | undefined,
): Promise<ApiKeyAuthIdentity | null> {
  const rawKey = parseApiKeyBearer(authorizationHeader);
  if (!rawKey) {
    return null;
  }

  return authenticateApiKey(database, rawKey);
}

/**
 * Require a valid workspace API key (`Authorization: Bearer pw_<key>`).
 * Attaches `apiKeyAuthIdentity` to the request context on success.
 */
export function apiKeyAuth(deps: ApiKeyAuthDeps): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const rawKey = parseApiKeyBearer(c.req.header("Authorization"));
    if (!rawKey) {
      return c.json(apiError("UNAUTHORIZED", "API key required"), 401);
    }

    const identity = await authenticateApiKey(deps.db, rawKey);
    if (!identity) {
      return c.json(apiError("UNAUTHORIZED", "Invalid or expired API key"), 401);
    }

    setApiKeyAuthIdentity(c, identity);
    await next();
  };
}

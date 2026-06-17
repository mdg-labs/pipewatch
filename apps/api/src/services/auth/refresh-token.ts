import { randomBytes } from "node:crypto";

import type { Db } from "@pipewatch/db";
import { refreshTokens } from "@pipewatch/db/schema";
import { sha256 } from "@pipewatch/utils";

export const REFRESH_COOKIE_NAME = "pw_refresh";
export const ACCESS_COOKIE_NAME = "pw_access";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RefreshCookieOptions = {
  secure: boolean;
  maxAgeSeconds: number;
  path: string;
};

/** Generate a cryptographically random opaque refresh token. */
export function generateRefreshTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash a refresh token for DB storage — never persist plaintext (PRD §7.1). */
export function hashRefreshToken(token: string): string {
  return sha256(token);
}

/** Persist a hashed refresh token row for the user. */
export async function storeRefreshToken(
  database: Db,
  userId: string,
  plainToken: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await database.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(plainToken),
    expiresAt,
  });
}

/** Cookie attributes for refresh and access tokens (PRD §20). */
export function buildAuthCookieOptions(secure: boolean): RefreshCookieOptions {
  return {
    secure,
    maxAgeSeconds: REFRESH_TOKEN_TTL_MS / 1000,
    path: "/",
  };
}

export { REFRESH_TOKEN_TTL_MS };

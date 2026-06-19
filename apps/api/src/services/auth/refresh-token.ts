import { randomBytes } from "node:crypto";

import type { Db } from "@pipewatch/db";
import { refreshTokens } from "@pipewatch/db/schema";
import { sha256 } from "@pipewatch/utils";
import { and, eq, isNull } from "drizzle-orm";

export const REFRESH_COOKIE_NAME = "pw_refresh";
export const ACCESS_COOKIE_NAME = "pw_access";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RefreshCookieOptions = {
  secure: boolean;
  maxAgeSeconds: number;
  path: string;
};

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

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

const INVALID_REFRESH_TOKEN_MESSAGE = "Invalid or expired refresh token";

/** Look up a refresh token row by plaintext value, regardless of revocation. */
export async function findRefreshTokenByHash(
  database: Db,
  plainToken: string,
): Promise<RefreshTokenRow | null> {
  const [row] = await database
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(plainToken)))
    .limit(1);

  return row ?? null;
}

/** Look up a non-revoked, unexpired refresh token row by plaintext value. */
export async function findActiveRefreshToken(
  database: Db,
  plainToken: string,
): Promise<RefreshTokenRow | null> {
  const row = await findRefreshTokenByHash(database, plainToken);

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return row;
}

/**
 * Revoke every active refresh token for the user when a revoked token is reused.
 * Signals possible account takeover (PRD §7.1, security audit §39).
 */
async function handleRevokedRefreshTokenReuse(
  database: Db,
  userId: string,
): Promise<void> {
  await revokeAllUserRefreshTokens(database, userId);
}

/** Require a valid refresh token cookie value or throw 401. */
export async function requireActiveRefreshToken(
  database: Db,
  plainToken: string | undefined,
): Promise<RefreshTokenRow> {
  if (!plainToken) {
    throw new AuthError("Missing refresh token", 401);
  }

  const row = await findActiveRefreshToken(database, plainToken);
  if (row) {
    return row;
  }

  const existing = await findRefreshTokenByHash(database, plainToken);
  if (existing?.revokedAt) {
    await handleRevokedRefreshTokenReuse(database, existing.userId);
  }

  throw new AuthError(INVALID_REFRESH_TOKEN_MESSAGE, 401);
}

/** Revoke a refresh token row by primary key. */
export async function revokeRefreshTokenById(
  database: Db,
  tokenId: string,
): Promise<void> {
  await database
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, tokenId), isNull(refreshTokens.revokedAt)));
}

/** Revoke all active refresh tokens for a user (logout-all). */
export async function revokeAllUserRefreshTokens(
  database: Db,
  userId: string,
): Promise<void> {
  await database
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/**
 * Rotate refresh token: revoke the old row and insert a new hashed token.
 * Returns the new plaintext token for the httpOnly cookie.
 */
export async function rotateRefreshToken(
  database: Db,
  userId: string,
  oldPlainToken: string,
): Promise<string> {
  const existing = await requireActiveRefreshToken(database, oldPlainToken);

  if (existing.userId !== userId) {
    throw new AuthError("Refresh token user mismatch", 401);
  }

  const newPlainToken = generateRefreshTokenValue();

  await database.transaction(async (tx) => {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id));

    await tx.insert(refreshTokens).values({
      userId,
      tokenHash: hashRefreshToken(newPlainToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
  });

  return newPlainToken;
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

import { and, eq, gt, isNull, or } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { apiKeys } from "@pipewatch/db/schema";
import type { ApiKeyAuthIdentity } from "@pipewatch/types";
import { sha256 } from "@pipewatch/utils";

export type ApiKeyLookupRow = {
  id: string;
  workspaceId: string;
  createdBy: string;
};

/**
 * Look up an active API key by raw bearer token.
 * Returns null when the hash is unknown, revoked, or expired.
 */
export async function lookupApiKey(
  database: Db,
  rawKey: string,
): Promise<ApiKeyLookupRow | null> {
  const keyHash = sha256(rawKey);
  const now = new Date();

  const [row] = await database
    .select({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      createdBy: apiKeys.createdBy,
    })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Update `last_used_at` after a successful API key authentication. */
export async function touchApiKeyLastUsed(database: Db, apiKeyId: string): Promise<void> {
  await database
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyId));
}

/**
 * Authenticate a raw API key: lookup, validate, and touch `last_used_at`.
 */
export async function authenticateApiKey(
  database: Db,
  rawKey: string,
): Promise<ApiKeyAuthIdentity | null> {
  const row = await lookupApiKey(database, rawKey);
  if (!row) {
    return null;
  }

  await touchApiKeyLastUsed(database, row.id);

  return {
    authMode: "api_key",
    apiKeyId: row.id,
    userId: row.createdBy,
    workspaceId: row.workspaceId,
  };
}

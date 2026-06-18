import { randomBytes } from "node:crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";

import { flags } from "@pipewatch/config/edition";
import type { Db } from "@pipewatch/db";
import { apiKeys, workspaces } from "@pipewatch/db/schema";
import type {
  ApiKeyAuthIdentity,
  ApiKeySummary,
  CreateApiKeyInput,
  CreatedApiKey,
} from "@pipewatch/types";
import { API_KEY_PREFIX } from "@pipewatch/types";
import type { WorkspacePlan } from "@pipewatch/types";
import { sha256 } from "@pipewatch/utils";

export type ApiKeyLookupRow = {
  id: string;
  workspaceId: string;
  createdBy: string;
};

export class ApiKeyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiKeyError";
    this.status = status;
    this.code = code;
  }
}

const KEY_PREFIX_LENGTH = 8;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapApiKeySummary(row: {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeySummary {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    name: row.name,
    key_prefix: row.keyPrefix,
    expires_at: toIso(row.expiresAt),
    last_used_at: toIso(row.lastUsedAt),
    revoked_at: toIso(row.revokedAt),
    created_at: row.createdAt.toISOString(),
  };
}

/** Generate a new workspace API key value (`pw_` + random suffix). */
export function generateApiKeyRaw(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/**
 * Cloud plan gate stub for API key creation (PRD §24, Decision #27).
 * Keys are allowed on all plans including CE/OSS; paid-only enforcement reserved.
 */
export function assertCanCreateApiKey(plan: WorkspacePlan): void {
  if (!flags.API_KEYS_ENABLED) {
    throw new ApiKeyError("API keys are not enabled for this edition", 403, "FORBIDDEN");
  }

  if (flags.IS_CE || !flags.PLAN_LIMITS_ENABLED) {
    return;
  }

  // Decision #27 — all cloud plans (free, pro, business) may create API keys.
  void plan;
}

async function getWorkspacePlan(database: Db, workspaceId: string): Promise<WorkspacePlan | null> {
  const [row] = await database
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return (row?.plan as WorkspacePlan | undefined) ?? null;
}

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

/** List API keys for a workspace (metadata only — never the full key). */
export async function listWorkspaceApiKeys(
  database: Db,
  workspaceId: string,
): Promise<ApiKeySummary[]> {
  const rows = await database
    .select({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, workspaceId))
    .orderBy(apiKeys.createdAt);

  return rows.map(mapApiKeySummary);
}

/** Create a workspace API key; returns the full key once in the response. */
export async function createWorkspaceApiKey(
  database: Db,
  workspaceId: string,
  createdBy: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  const plan = await getWorkspacePlan(database, workspaceId);
  if (!plan) {
    throw new ApiKeyError("Workspace not found", 404, "NOT_FOUND");
  }

  assertCanCreateApiKey(plan);

  const expiresAt = input.expires_at ? new Date(input.expires_at) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new ApiKeyError("expires_at must be a valid ISO datetime", 422, "VALIDATION_ERROR");
  }

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new ApiKeyError("expires_at must be in the future", 422, "VALIDATION_ERROR");
  }

  const rawKey = generateApiKeyRaw();
  const keyHash = sha256(rawKey);
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);

  const [row] = await database
    .insert(apiKeys)
    .values({
      workspaceId,
      createdBy,
      name: input.name.trim(),
      keyHash,
      keyPrefix,
      expiresAt,
    })
    .returning({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    });

  if (!row) {
    throw new ApiKeyError("Failed to create API key", 500, "INTERNAL_ERROR");
  }

  return {
    ...mapApiKeySummary(row),
    key: rawKey,
  };
}

/** Revoke an API key by setting `revoked_at` (semantic delete). */
export async function revokeWorkspaceApiKey(
  database: Db,
  workspaceId: string,
  keyId: string,
): Promise<void> {
  const [existing] = await database
    .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.workspaceId, workspaceId)))
    .limit(1);

  if (!existing) {
    throw new ApiKeyError("API key not found", 404, "NOT_FOUND");
  }

  if (existing.revokedAt) {
    return;
  }

  await database
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));
}

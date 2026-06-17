/** Prefix for workspace API keys sent as `Authorization: Bearer pw_<key>` (PRD §7.1). */
export const API_KEY_PREFIX = "pw_" as const;

/** Resolved identity after a valid API key lookup. */
export type ApiKeyAuthIdentity = {
  authMode: "api_key";
  apiKeyId: string;
  userId: string;
  workspaceId: string;
};

/** Public API key metadata — never includes the raw key or hash. */
export type ApiKeySummary = {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

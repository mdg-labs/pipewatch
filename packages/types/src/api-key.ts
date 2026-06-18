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
  workspace_id: string;
  name: string;
  key_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** Response when creating an API key — full key shown once. */
export type CreatedApiKey = ApiKeySummary & {
  key: string;
};

export type CreateApiKeyInput = {
  name: string;
  expires_at?: string | undefined;
};

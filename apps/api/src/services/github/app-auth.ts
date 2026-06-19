import { SignJWT, importPKCS8 } from "jose";
import { eq } from "drizzle-orm";

import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { integrations } from "@pipewatch/db/schema";
import { decrypt, encrypt } from "@pipewatch/utils";

const GITHUB_API_BASE = "https://api.github.com";
const APP_JWT_TTL_SECONDS = 9 * 60;
/** Refresh installation tokens this many ms before `token_expires_at`. */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class GitHubAppAuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "GitHubAppAuthError";
    this.status = status;
    this.code = code;
  }
}

export type GitHubAppConfig = {
  appId: string;
  privateKey: string;
  encryptionKey: string;
};

export type InstallationTokenResponse = {
  token: string;
  expires_at: string;
};

export type GitHubInstallationAccount = {
  login: string;
  type: string;
};

export type GitHubInstallationResponse = {
  account: GitHubInstallationAccount;
};

export type IntegrationRecord = {
  id: string;
  workspaceId: string;
  externalInstallationId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
};

/** Build GitHub App config from validated API env — fails when credentials are missing. */
export function gitHubAppConfigFromEnv(env: ApiEnv): GitHubAppConfig {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new GitHubAppAuthError(
      "GitHub App credentials are not configured",
      500,
      "GITHUB_APP_NOT_CONFIGURED",
    );
  }

  if (!env.ENCRYPTION_KEY) {
    throw new GitHubAppAuthError(
      "ENCRYPTION_KEY is not configured",
      500,
      "ENCRYPTION_KEY_MISSING",
    );
  }

  return {
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    encryptionKey: env.ENCRYPTION_KEY,
  };
}

/**
 * Normalize PEM private key from env — supports literal newlines, escaped `\\n`, and
 * base64-encoded PEM blobs (Phase stores `GITHUB_APP_PRIVATE_KEY` base64-encoded).
 */
export function normalizePrivateKey(rawKey: string): string {
  const trimmed = rawKey.trim();

  if (trimmed.includes("-----BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }

  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.includes("-----BEGIN")) {
    return decoded.replace(/\\n/g, "\n");
  }

  throw new GitHubAppAuthError(
    "GITHUB_APP_PRIVATE_KEY is not a valid PEM key",
    500,
    "INVALID_GITHUB_APP_PRIVATE_KEY",
  );
}

/** Sign a short-lived RS256 JWT for GitHub App authentication (PRD §4.4). */
export async function createAppJwt(config: GitHubAppConfig): Promise<string> {
  const privateKey = await importPKCS8(
    normalizePrivateKey(config.privateKey),
    "RS256",
  );

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(config.appId)
    .setExpirationTime(`${String(APP_JWT_TTL_SECONDS)}s`)
    .sign(privateKey);
}

/** True when the token is missing or expires within the refresh buffer. */
export function isInstallationTokenExpired(
  expiresAt: Date | null,
  now: Date = new Date(),
  bufferMs: number = TOKEN_REFRESH_BUFFER_MS,
): boolean {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() - now.getTime() <= bufferMs;
}

async function parseInstallationTokenResponse(
  response: Response,
): Promise<InstallationTokenResponse> {
  if (!response.ok) {
    throw new GitHubAppAuthError(
      `GitHub installation token exchange failed (${String(response.status)})`,
      response.status === 401 ? 401 : 502,
      "GITHUB_TOKEN_EXCHANGE_FAILED",
    );
  }

  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { token?: unknown }).token !== "string" ||
    typeof (body as { expires_at?: unknown }).expires_at !== "string"
  ) {
    throw new GitHubAppAuthError(
      "GitHub installation token response is invalid",
      502,
      "GITHUB_TOKEN_EXCHANGE_INVALID",
    );
  }

  return {
    token: (body as { token: string }).token,
    expires_at: (body as { expires_at: string }).expires_at,
  };
}

async function parseInstallationResponse(response: Response): Promise<GitHubInstallationResponse> {
  if (!response.ok) {
    const status =
      response.status === 404 ? 404 : response.status === 401 ? 401 : 502;
    throw new GitHubAppAuthError(
      `GitHub installation lookup failed (${String(response.status)})`,
      status,
      "GITHUB_INSTALLATION_LOOKUP_FAILED",
    );
  }

  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { account?: unknown }).account !== "object" ||
    (body as { account: unknown }).account === null
  ) {
    throw new GitHubAppAuthError(
      "GitHub installation response is invalid",
      502,
      "GITHUB_INSTALLATION_INVALID",
    );
  }

  const account = (body as { account: GitHubInstallationAccount }).account;

  if (typeof account.login !== "string" || typeof account.type !== "string") {
    throw new GitHubAppAuthError(
      "GitHub installation account is invalid",
      502,
      "GITHUB_INSTALLATION_INVALID",
    );
  }

  return { account };
}

/** Fetch GitHub App installation metadata (account login and type). */
export async function fetchInstallation(
  installationId: string,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubInstallationResponse> {
  const appJwt = await createAppJwt(config);

  const response = await fetchImpl(
    `${GITHUB_API_BASE}/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  return parseInstallationResponse(response);
}

/** Exchange an App JWT for a short-lived installation access token. */
export async function exchangeInstallationToken(
  installationId: string,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<InstallationTokenResponse> {
  const appJwt = await createAppJwt(config);

  const response = await fetchImpl(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  return parseInstallationTokenResponse(response);
}

async function loadIntegrationByInstallationId(
  database: Db,
  installationId: string,
): Promise<IntegrationRecord | null> {
  const [row] = await database
    .select({
      id: integrations.id,
      workspaceId: integrations.workspaceId,
      externalInstallationId: integrations.externalInstallationId,
      accessToken: integrations.accessToken,
      tokenExpiresAt: integrations.tokenExpiresAt,
    })
    .from(integrations)
    .where(eq(integrations.externalInstallationId, installationId))
    .limit(1);

  return row ?? null;
}

async function persistInstallationToken(
  database: Db,
  integrationId: string,
  token: string,
  expiresAt: Date,
  encryptionKey: string,
): Promise<void> {
  const encryptedToken = encrypt(token, encryptionKey);

  await database
    .update(integrations)
    .set({
      accessToken: encryptedToken,
      tokenExpiresAt: expiresAt,
    })
    .where(eq(integrations.id, integrationId));
}

/**
 * Return a valid installation access token — lazy refresh when near expiry.
 * Persists encrypted `access_token` and `token_expires_at` on the integration row.
 */
export async function getInstallationToken(
  database: Db,
  installationId: string,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const integration = await loadIntegrationByInstallationId(database, installationId);

  if (!integration) {
    throw new GitHubAppAuthError(
      "Integration not found for installation",
      404,
      "INTEGRATION_NOT_FOUND",
    );
  }

  return ensureInstallationToken(database, integration, config, fetchImpl);
}

/**
 * Ensure a decrypted installation token for an integration row — refreshes when stale.
 */
export async function ensureInstallationToken(
  database: Db,
  integration: IntegrationRecord,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!isInstallationTokenExpired(integration.tokenExpiresAt)) {
    return decrypt(integration.accessToken, config.encryptionKey);
  }

  const exchanged = await exchangeInstallationToken(
    integration.externalInstallationId,
    config,
    fetchImpl,
  );

  const expiresAt = new Date(exchanged.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new GitHubAppAuthError(
      "GitHub installation token expiry is invalid",
      502,
      "GITHUB_TOKEN_EXPIRY_INVALID",
    );
  }

  await persistInstallationToken(
    database,
    integration.id,
    exchanged.token,
    expiresAt,
    config.encryptionKey,
  );

  return exchanged.token;
}

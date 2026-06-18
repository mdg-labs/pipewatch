import { SignJWT, importPKCS8 } from "jose";
import { and, eq } from "drizzle-orm";

import { flags } from "@pipewatch/config/edition";
import type { WorkerEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { integrations, repositories, workspaces } from "@pipewatch/db/schema";
import type { WorkspacePlan } from "@pipewatch/types";
import {
  decrypt,
  encrypt,
  mapWorkflowRunPayload,
  type GitHubWorkflowRun,
  type PipelineRunUpsert,
} from "@pipewatch/utils";

import { upsertPipelineRun } from "../pipeline-upsert.js";

const GITHUB_API_BASE = "https://api.github.com";
const APP_JWT_TTL_SECONDS = 9 * 60;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 1_000;
const REPOS_PER_PAGE = 100;
const RUNS_PER_PAGE = 100;

export class GitHubBackfillError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GitHubBackfillError";
    this.status = status;
    this.code = code;
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

export type GitHubAppConfig = {
  appId: string;
  privateKey: string;
  encryptionKey: string;
};

export type IntegrationRecord = {
  id: string;
  workspaceId: string;
  externalInstallationId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
};

export type GitHubInstallationRepository = {
  id: number;
  full_name: string;
  private: boolean;
};

type GitHubInstallationRepositoriesResponse = {
  total_count: number;
  repositories: GitHubInstallationRepository[];
};

type GitHubWorkflowRunsResponse = {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
};

export type GitHubFetchDeps = {
  database: Db;
  config: GitHubAppConfig;
  integration: IntegrationRecord;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
};

export function gitHubAppConfigFromWorkerEnv(env: WorkerEnv): GitHubAppConfig {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new GitHubBackfillError(
      "GitHub App credentials are not configured",
      500,
      "GITHUB_APP_NOT_CONFIGURED",
    );
  }

  if (!env.ENCRYPTION_KEY) {
    throw new GitHubBackfillError(
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

function normalizePrivateKey(rawKey: string): string {
  const trimmed = rawKey.trim();

  if (trimmed.includes("-----BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }

  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.includes("-----BEGIN")) {
    return decoded.replace(/\\n/g, "\n");
  }

  throw new GitHubBackfillError(
    "GITHUB_APP_PRIVATE_KEY is not a valid PEM key",
    500,
    "INVALID_GITHUB_APP_PRIVATE_KEY",
  );
}

async function createAppJwt(config: GitHubAppConfig): Promise<string> {
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

function isInstallationTokenExpired(
  expiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() - now.getTime() <= TOKEN_REFRESH_BUFFER_MS;
}

async function exchangeInstallationToken(
  installationId: string,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch,
): Promise<{ token: string; expires_at: string }> {
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

  if (!response.ok) {
    throw new GitHubBackfillError(
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
    throw new GitHubBackfillError(
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

async function ensureInstallationToken(
  database: Db,
  integration: IntegrationRecord,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch,
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
    throw new GitHubBackfillError(
      "GitHub installation token expiry is invalid",
      502,
      "GITHUB_TOKEN_EXPIRY_INVALID",
    );
  }

  const encryptedToken = encrypt(exchanged.token, config.encryptionKey);
  await database
    .update(integrations)
    .set({
      accessToken: encryptedToken,
      tokenExpiresAt: expiresAt,
    })
    .where(eq(integrations.id, integration.id));

  integration.accessToken = encryptedToken;
  integration.tokenExpiresAt = expiresAt;

  return exchanged.token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) {
      return seconds * 1_000;
    }

    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
  }

  const reset = response.headers.get("x-ratelimit-reset");
  if (reset) {
    const resetMs = Number(reset) * 1_000;
    if (!Number.isNaN(resetMs)) {
      return Math.max(0, resetMs - Date.now() + 1_000);
    }
  }

  return 60_000;
}

function isRateLimited(response: Response): boolean {
  if (response.status === 429) {
    return true;
  }

  if (response.status !== 403) {
    return false;
  }

  if (response.headers.get("x-ratelimit-remaining") === "0") {
    return true;
  }

  return response.headers.has("retry-after");
}

function githubRequestHeaders(token: string, init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  return headers;
}

/** Rate-limit aware GitHub REST fetch — lazy token refresh and exponential backoff (PRD §15). */
export async function githubFetch(
  url: string,
  init: RequestInit | undefined,
  deps: GitHubFetchDeps,
): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;

  let token: string;
  try {
    token = await ensureInstallationToken(
      deps.database,
      deps.integration,
      deps.config,
      fetchImpl,
    );
  } catch (error) {
    if (error instanceof GitHubBackfillError) {
      throw error;
    }
    throw error;
  }

  let attempt = 0;
  let backoffMs = DEFAULT_BACKOFF_MS;

  while (true) {
    const response = await fetchImpl(url, {
      ...init,
      headers: githubRequestHeaders(token, init),
    });

    if (!isRateLimited(response) || attempt >= maxRetries) {
      return response;
    }

    const retryAfterMs = parseRetryAfterMs(response);
    await sleep(Math.max(retryAfterMs, backoffMs));
    attempt += 1;
    backoffMs *= 2;
  }
}

function parseWorkspacePlan(plan: string): WorkspacePlan {
  if (plan === "pro" || plan === "business") {
    return plan;
  }

  return "free";
}

/** Effective retention window — repo override, workspace default, plan ceiling (PRD §6, §24). */
export function resolveEffectiveRetentionDays(
  repoRetentionDays: number | null,
  workspaceDefaultRetentionDays: number,
  workspacePlan: string,
  envRetentionDays: number,
): number {
  const baseDays = repoRetentionDays ?? (
    flags.RETENTION_CEILING ? workspaceDefaultRetentionDays : envRetentionDays
  );

  if (!flags.RETENTION_CEILING) {
    return baseDays;
  }

  const plan = parseWorkspacePlan(workspacePlan);
  if (plan === "free") {
    return 30;
  }

  return Math.min(baseDays, 365);
}

export function retentionCreatedSince(retentionDays: number, now = new Date()): string {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 10);
}

export async function loadIntegrationRecord(
  database: Db,
  integrationId: string,
  workspaceId: string,
): Promise<IntegrationRecord> {
  const [row] = await database
    .select({
      id: integrations.id,
      workspaceId: integrations.workspaceId,
      externalInstallationId: integrations.externalInstallationId,
      accessToken: integrations.accessToken,
      tokenExpiresAt: integrations.tokenExpiresAt,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.id, integrationId),
        eq(integrations.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new GitHubBackfillError(
      "Integration not found for workspace",
      404,
      "INTEGRATION_NOT_FOUND",
    );
  }

  return row;
}

export async function loadRepositoryRecord(
  database: Db,
  repoId: string,
  workspaceId: string,
): Promise<typeof repositories.$inferSelect> {
  const [row] = await database
    .select()
    .from(repositories)
    .where(and(eq(repositories.id, repoId), eq(repositories.workspaceId, workspaceId)))
    .limit(1);

  if (!row) {
    throw new GitHubBackfillError(
      "Repository not found for workspace",
      404,
      "REPOSITORY_NOT_FOUND",
    );
  }

  return row;
}

async function parseJsonResponse<T>(response: Response, code: string): Promise<T> {
  if (!response.ok) {
    throw new GitHubBackfillError(
      `GitHub API request failed (${String(response.status)})`,
      response.status,
      code,
    );
  }

  return (await response.json()) as T;
}

export async function fetchInstallationRepositoriesPage(
  page: number,
  deps: GitHubFetchDeps,
): Promise<GitHubInstallationRepositoriesResponse> {
  const url = `${GITHUB_API_BASE}/installation/repositories?per_page=${String(REPOS_PER_PAGE)}&page=${String(page)}`;
  const response = await githubFetch(url, { method: "GET" }, deps);
  return parseJsonResponse<GitHubInstallationRepositoriesResponse>(
    response,
    "GITHUB_REPOS_FETCH_FAILED",
  );
}

export async function upsertDiscoveredRepository(
  database: Db,
  input: {
    workspaceId: string;
    integrationId: string;
    externalRepoId: string;
    fullName: string;
    private: boolean;
  },
): Promise<typeof repositories.$inferSelect> {
  const [row] = await database
    .insert(repositories)
    .values({
      workspaceId: input.workspaceId,
      integrationId: input.integrationId,
      externalRepoId: input.externalRepoId,
      fullName: input.fullName,
      private: input.private,
      enabled: true,
    })
    .onConflictDoUpdate({
      target: [repositories.integrationId, repositories.externalRepoId],
      set: {
        fullName: input.fullName,
        private: input.private,
      },
    })
    .returning();

  if (!row) {
    throw new GitHubBackfillError(
      "Failed to upsert discovered repository",
      500,
      "REPOSITORY_UPSERT_FAILED",
    );
  }

  return row;
}

export async function fetchWorkflowRunsPage(
  fullName: string,
  page: number,
  createdSince: string,
  deps: GitHubFetchDeps,
): Promise<GitHubWorkflowRunsResponse> {
  const encodedRepo = encodeURIComponent(fullName).replace(/%2F/g, "/");
  const url =
    `${GITHUB_API_BASE}/repos/${encodedRepo}/actions/runs` +
    `?per_page=${String(RUNS_PER_PAGE)}&page=${String(page)}` +
    `&created=${encodeURIComponent(`>=${createdSince}`)}`;

  const response = await githubFetch(url, { method: "GET" }, deps);
  return parseJsonResponse<GitHubWorkflowRunsResponse>(
    response,
    "GITHUB_RUNS_FETCH_FAILED",
  );
}

export function mapRestWorkflowRun(
  run: GitHubWorkflowRun,
  context: { workspaceId: string; repoId: string },
): PipelineRunUpsert {
  return mapWorkflowRunPayload(
    { action: "completed", workflow_run: run },
    context,
  );
}

export async function ingestWorkflowRuns(
  database: Db,
  runs: GitHubWorkflowRun[],
  context: { workspaceId: string; repoId: string },
): Promise<number> {
  let ingested = 0;

  for (const run of runs) {
    const mapped = mapRestWorkflowRun(run, context);
    await upsertPipelineRun(database, mapped);
    ingested += 1;
  }

  return ingested;
}

export async function loadWorkspaceRetentionContext(
  database: Db,
  workspaceId: string,
): Promise<{ defaultRetentionDays: number; plan: string }> {
  const [row] = await database
    .select({
      defaultRetentionDays: workspaces.defaultRetentionDays,
      plan: workspaces.plan,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!row) {
    throw new GitHubBackfillError(
      "Workspace not found",
      404,
      "WORKSPACE_NOT_FOUND",
    );
  }

  return row;
}

export async function markRepositorySynced(
  database: Db,
  repoId: string,
  syncedAt: Date,
): Promise<void> {
  await database
    .update(repositories)
    .set({ lastSyncedAt: syncedAt })
    .where(eq(repositories.id, repoId));
}

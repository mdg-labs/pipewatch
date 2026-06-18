import { and, count, eq, sql } from "drizzle-orm";

import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { integrations, repositories } from "@pipewatch/db/schema";
import type {
  CreateIntegrationInput,
  IntegrationAccountType,
  IntegrationSummary,
  IntegrationTokenHealth,
} from "@pipewatch/types";
import { encrypt } from "@pipewatch/utils";

import {
  TOKEN_REFRESH_BUFFER_MS,
  gitHubAppConfigFromEnv,
} from "../github/app-auth.js";
import { isUniqueViolation } from "../workspaces/workspace.service.js";

export class IntegrationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "IntegrationError";
    this.status = status;
    this.code = code;
  }
}

function parseAccountType(value: string): IntegrationAccountType {
  if (value === "Organization" || value === "User") {
    return value;
  }

  throw new IntegrationError(
    "account_type must be Organization or User",
    422,
    "VALIDATION_ERROR",
  );
}

export function computeTokenHealth(
  tokenExpiresAt: Date | null,
  now: Date = new Date(),
): IntegrationTokenHealth {
  if (!tokenExpiresAt || tokenExpiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  if (tokenExpiresAt.getTime() - now.getTime() <= TOKEN_REFRESH_BUFFER_MS) {
    return "expiring";
  }

  return "healthy";
}

function toIntegrationSummary(row: {
  id: string;
  workspaceId: string;
  provider: string;
  externalInstallationId: string;
  accountLogin: string;
  accountType: string;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  connectedRepoCount: number;
}): IntegrationSummary {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    provider: "github",
    external_installation_id: row.externalInstallationId,
    account_login: row.accountLogin,
    account_type: parseAccountType(row.accountType),
    connected_repo_count: row.connectedRepoCount,
    token_health: computeTokenHealth(row.tokenExpiresAt),
    token_expires_at: row.tokenExpiresAt ? row.tokenExpiresAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}

async function loadIntegrationSummary(
  database: Db,
  workspaceId: string,
  integrationId: string,
): Promise<IntegrationSummary | null> {
  const [row] = await database
    .select({
      id: integrations.id,
      workspaceId: integrations.workspaceId,
      provider: integrations.provider,
      externalInstallationId: integrations.externalInstallationId,
      accountLogin: integrations.accountLogin,
      accountType: integrations.accountType,
      tokenExpiresAt: integrations.tokenExpiresAt,
      createdAt: integrations.createdAt,
      connectedRepoCount: sql<number>`cast(count(${repositories.id}) filter (where ${repositories.enabled} = true) as int)`,
    })
    .from(integrations)
    .leftJoin(repositories, eq(repositories.integrationId, integrations.id))
    .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.id, integrationId)))
    .groupBy(integrations.id)
    .limit(1);

  if (!row) {
    return null;
  }

  return toIntegrationSummary(row);
}

/** List workspace integrations with repo counts and token health. */
export async function listWorkspaceIntegrations(
  database: Db,
  workspaceId: string,
): Promise<IntegrationSummary[]> {
  const rows = await database
    .select({
      id: integrations.id,
      workspaceId: integrations.workspaceId,
      provider: integrations.provider,
      externalInstallationId: integrations.externalInstallationId,
      accountLogin: integrations.accountLogin,
      accountType: integrations.accountType,
      tokenExpiresAt: integrations.tokenExpiresAt,
      createdAt: integrations.createdAt,
      connectedRepoCount: sql<number>`cast(count(${repositories.id}) filter (where ${repositories.enabled} = true) as int)`,
    })
    .from(integrations)
    .leftJoin(repositories, eq(repositories.integrationId, integrations.id))
    .where(eq(integrations.workspaceId, workspaceId))
    .groupBy(integrations.id)
    .orderBy(integrations.createdAt);

  return rows.map((row) => toIntegrationSummary(row));
}

/** Fetch a single workspace integration by id. */
export async function getWorkspaceIntegration(
  database: Db,
  workspaceId: string,
  integrationId: string,
): Promise<IntegrationSummary | null> {
  return loadIntegrationSummary(database, workspaceId, integrationId);
}

/** Create an integration row from a GitHub App installation callback payload. */
export async function createWorkspaceIntegration(
  database: Db,
  env: ApiEnv,
  workspaceId: string,
  input: CreateIntegrationInput,
): Promise<IntegrationSummary> {
  const provider = input.provider ?? "github";
  if (provider !== "github") {
    throw new IntegrationError("Only github integrations are supported", 422, "VALIDATION_ERROR");
  }

  const accountType = parseAccountType(input.account_type);
  const tokenExpiresAt = new Date(input.token_expires_at);
  if (Number.isNaN(tokenExpiresAt.getTime())) {
    throw new IntegrationError("token_expires_at must be a valid datetime", 422, "VALIDATION_ERROR");
  }

  const config = gitHubAppConfigFromEnv(env);
  const encryptedToken = encrypt(input.access_token, config.encryptionKey);

  try {
    const [created] = await database
      .insert(integrations)
      .values({
        workspaceId,
        provider,
        externalInstallationId: input.external_installation_id,
        accountLogin: input.account_login,
        accountType,
        accessToken: encryptedToken,
        tokenExpiresAt,
      })
      .returning({
        id: integrations.id,
        workspaceId: integrations.workspaceId,
        provider: integrations.provider,
        externalInstallationId: integrations.externalInstallationId,
        accountLogin: integrations.accountLogin,
        accountType: integrations.accountType,
        tokenExpiresAt: integrations.tokenExpiresAt,
        createdAt: integrations.createdAt,
      });

    if (!created) {
      throw new IntegrationError("Failed to create integration", 500, "INTERNAL_ERROR");
    }

    return toIntegrationSummary({ ...created, connectedRepoCount: 0 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new IntegrationError(
        "This GitHub installation is already connected",
        409,
        "INTEGRATION_EXISTS",
      );
    }

    throw error;
  }
}

/** Disconnect an integration — disable repos, then delete the integration row. */
export async function deleteWorkspaceIntegration(
  database: Db,
  workspaceId: string,
  integrationId: string,
): Promise<void> {
  const [existing] = await database
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.id, integrationId)))
    .limit(1);

  if (!existing) {
    throw new IntegrationError("Integration not found", 404, "NOT_FOUND");
  }

  await database.transaction(async (tx) => {
    await tx
      .update(repositories)
      .set({ enabled: false })
      .where(
        and(
          eq(repositories.workspaceId, workspaceId),
          eq(repositories.integrationId, integrationId),
        ),
      );

    await tx
      .delete(integrations)
      .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.id, integrationId)));
  });
}

/** Count enabled repositories for an integration — used in tests. */
export async function countEnabledRepositories(
  database: Db,
  integrationId: string,
): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(repositories)
    .where(and(eq(repositories.integrationId, integrationId), eq(repositories.enabled, true)));

  return row?.total ?? 0;
}

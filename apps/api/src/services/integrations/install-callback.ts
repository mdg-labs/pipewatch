import { and, eq } from "drizzle-orm";

import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { integrations } from "@pipewatch/db/schema";
import type { IntegrationAccountType, IntegrationSummary } from "@pipewatch/types";
import { encrypt } from "@pipewatch/utils";

import {
  GitHubAppAuthError,
  exchangeInstallationToken,
  fetchInstallation,
  gitHubAppConfigFromEnv,
} from "../github/app-auth.js";
import {
  IntegrationError,
  computeTokenHealth,
} from "./integration.service.js";
import { isUniqueViolation } from "../workspaces/workspace.service.js";
import { enqueueBackfillIntegration } from "@pipewatch/worker/queues/backfill.js";

export class InstallCallbackError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "InstallCallbackError";
    this.status = status;
    this.code = code;
  }
}

export type EnqueueBackfillIntegration = (payload: {
  integrationId: string;
  workspaceId: string;
}) => Promise<void>;

export type InstallCallbackDeps = {
  fetchImpl?: typeof fetch;
  enqueueBackfill?: EnqueueBackfillIntegration;
};

function parseAccountType(value: string): IntegrationAccountType {
  if (value === "Organization" || value === "User") {
    return value;
  }

  throw new InstallCallbackError(
    "GitHub installation account type is invalid",
    502,
    "GITHUB_INSTALLATION_INVALID",
  );
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
}): IntegrationSummary {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    provider: "github",
    external_installation_id: row.externalInstallationId,
    account_login: row.accountLogin,
    account_type: parseAccountType(row.accountType),
    connected_repo_count: 0,
    token_health: computeTokenHealth(row.tokenExpiresAt),
    token_expires_at: row.tokenExpiresAt ? row.tokenExpiresAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}

function validateInstallationId(installationId: string): string {
  const trimmed = installationId.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new InstallCallbackError(
      "installation_id must be a numeric GitHub installation ID",
      422,
      "VALIDATION_ERROR",
    );
  }

  return trimmed;
}

function mapGitHubError(error: GitHubAppAuthError): never {
  if (error.code === "GITHUB_INSTALLATION_LOOKUP_FAILED" && error.status === 404) {
    throw new InstallCallbackError(
      "GitHub installation not found",
      404,
      "GITHUB_INSTALLATION_NOT_FOUND",
    );
  }

  throw new InstallCallbackError(error.message, error.status, error.code);
}

/**
 * Process GitHub App install callback — upsert integration, enqueue backfill (PRD §12.1).
 */
export async function processGitHubInstallCallback(
  database: Db,
  env: ApiEnv,
  workspaceId: string,
  rawInstallationId: string,
  deps: InstallCallbackDeps = {},
): Promise<IntegrationSummary> {
  const installationId = validateInstallationId(rawInstallationId);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const config = gitHubAppConfigFromEnv(env);

  let installation;
  let tokenExchange;

  try {
    [installation, tokenExchange] = await Promise.all([
      fetchInstallation(installationId, config, fetchImpl),
      exchangeInstallationToken(installationId, config, fetchImpl),
    ]);
  } catch (error) {
    if (error instanceof GitHubAppAuthError) {
      mapGitHubError(error);
    }

    throw error;
  }

  const accountType = parseAccountType(installation.account.type);
  const tokenExpiresAt = new Date(tokenExchange.expires_at);
  if (Number.isNaN(tokenExpiresAt.getTime())) {
    throw new InstallCallbackError(
      "GitHub installation token expiry is invalid",
      502,
      "GITHUB_TOKEN_EXPIRY_INVALID",
    );
  }

  const encryptedToken = encrypt(tokenExchange.token, config.encryptionKey);

  const [existing] = await database
    .select({
      id: integrations.id,
      workspaceId: integrations.workspaceId,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "github"),
        eq(integrations.externalInstallationId, installationId),
      ),
    )
    .limit(1);

  if (existing && existing.workspaceId !== workspaceId) {
    throw new IntegrationError(
      "This GitHub installation is already connected to another workspace",
      409,
      "INTEGRATION_EXISTS",
    );
  }

  let row: {
    id: string;
    workspaceId: string;
    provider: string;
    externalInstallationId: string;
    accountLogin: string;
    accountType: string;
    tokenExpiresAt: Date | null;
    createdAt: Date;
  };

  if (existing) {
    const [updated] = await database
      .update(integrations)
      .set({
        accountLogin: installation.account.login,
        accountType,
        accessToken: encryptedToken,
        tokenExpiresAt,
      })
      .where(eq(integrations.id, existing.id))
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

    if (!updated) {
      throw new InstallCallbackError("Failed to update integration", 500, "INTERNAL_ERROR");
    }

    row = updated;
  } else {
    try {
      const [created] = await database
        .insert(integrations)
        .values({
          workspaceId,
          provider: "github",
          externalInstallationId: installationId,
          accountLogin: installation.account.login,
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
        throw new InstallCallbackError("Failed to create integration", 500, "INTERNAL_ERROR");
      }

      row = created;
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

  const enqueue = deps.enqueueBackfill;
  if (enqueue) {
    await enqueue({ integrationId: row.id, workspaceId });
  } else if (env.REDIS_URL) {
    await enqueueBackfillIntegration(env.REDIS_URL, {
      integrationId: row.id,
      workspaceId,
    });
  }

  return toIntegrationSummary(row);
}

import type { IntegrationProvider } from "./common.js";

export type IntegrationAccountType = "Organization" | "User";

/** Read-only token status for integration cards (PRD §7, pages B10). */
export type IntegrationTokenHealth = "healthy" | "expiring" | "expired";

/** Integration list/detail API resource — never includes encrypted access tokens. */
export type IntegrationSummary = {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  external_installation_id: string;
  account_login: string;
  account_type: IntegrationAccountType;
  connected_repo_count: number;
  token_health: IntegrationTokenHealth;
  token_expires_at: string | null;
  created_at: string;
};

/** @deprecated Use IntegrationSummary — kept for transitional imports. */
export type Integration = IntegrationSummary;

/** Body for POST /integrations after GitHub App install callback processing. */
export type CreateIntegrationInput = {
  external_installation_id: string;
  account_login: string;
  account_type: IntegrationAccountType;
  access_token: string;
  token_expires_at: string;
  provider?: IntegrationProvider | undefined;
};

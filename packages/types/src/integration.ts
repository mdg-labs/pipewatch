import type { IntegrationProvider } from "./common.js";

/** Integration API resource — placeholder; Zod schemas added in P2/P3. */
export interface Integration {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  externalInstallationId: string;
  accountLogin: string;
  accountType: "Organization" | "User";
  createdAt: string;
}

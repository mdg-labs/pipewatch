import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { workspaces } from "./workspaces.js";

/**
 * CI provider integration (PRD §6, §4.5 — Decision #37).
 * MVP: `provider = 'github'` only. GitHub-specific IDs live in `external_*` columns.
 *
 * **Cascade:** workspace delete removes integrations (and repositories via integration FK).
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("github"),
    externalInstallationId: text("external_installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    /** Encrypted at application layer before persistence (PRD §6). */
    accessToken: text("access_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("integrations_provider_external_installation_id_unique").on(
      table.provider,
      table.externalInstallationId,
    ),
  ],
);

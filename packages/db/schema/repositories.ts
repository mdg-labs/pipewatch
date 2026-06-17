import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { integrations } from "./integrations.js";
import { workspaces } from "./workspaces.js";

/**
 * Tracked repository under an integration (PRD §6, §4.5 — Decision #37).
 * Denormalized `workspace_id` for fast workspace-scoped queries (Decision #31).
 *
 * **Cascade:** workspace or integration delete removes repositories.
 */
export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    externalRepoId: text("external_repo_id").notNull(),
    fullName: text("full_name").notNull(),
    private: boolean("private").notNull(),
    /** false = stored but not synced (PRD §6). */
    enabled: boolean("enabled").notNull().default(true),
    /** null = webhook mode; default 60s in polling mode, min 30 (PRD §4.4). */
    pollingIntervalSeconds: integer("polling_interval_seconds"),
    /** null = use workspace plan default (PRD §6). */
    retentionDays: integer("retention_days"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (table) => [
    unique("repositories_integration_id_external_repo_id_unique").on(
      table.integrationId,
      table.externalRepoId,
    ),
  ],
);

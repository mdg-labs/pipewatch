import { desc, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { adminSchema } from "./admin-schema.js";

/**
 * GitHub hook delivery facts ingested by the admin poll job (Admin PRD §7.1).
 */
export const webhookDeliveries = adminSchema.table(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubDeliveryId: text("github_delivery_id").notNull(),
    githubGuid: text("github_guid").notNull(),
    externalInstallationId: text("external_installation_id"),
    integrationId: uuid("integration_id"),
    workspaceId: uuid("workspace_id"),
    event: text("event").notNull(),
    action: text("action"),
    statusCode: integer("status_code").notNull(),
    status: text("status").notNull(),
    duration: real("duration"),
    redelivery: boolean("redelivery").notNull().default(false),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull(),
    polledAt: timestamp("polled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set on insert only — never updated on upsert; used for ingest lag (Admin PRD §9.1). */
    firstPolledAt: timestamp("first_polled_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("webhook_deliveries_github_delivery_id_unique").on(
      table.githubDeliveryId,
    ),
    index("webhook_deliveries_workspace_id_delivered_at_idx").on(
      table.workspaceId,
      desc(table.deliveredAt),
    ),
    index("webhook_deliveries_external_installation_id_delivered_at_idx").on(
      table.externalInstallationId,
      desc(table.deliveredAt),
    ),
    index("webhook_deliveries_delivered_at_idx").on(table.deliveredAt),
    index("webhook_deliveries_failures_idx")
      .on(table.statusCode, desc(table.deliveredAt))
      .where(sql`${table.statusCode} = 0 OR ${table.statusCode} >= 300`),
  ],
);

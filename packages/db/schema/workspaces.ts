import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Workspace tenant root (PRD §5, §6).
 *
 * **Workspace delete cascades** (via FK `onDelete: "cascade"` on child tables):
 * - `workspace_members`
 * - `workspace_invites`
 * - `integrations`, `repositories`, `pipeline_*`, `api_keys` (added in P2-03+)
 */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** Cloud paid default; free tier fixed at 30d in application logic (PRD §5). */
  defaultRetentionDays: integer("default_retention_days").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

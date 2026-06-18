import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Waitlist and newsletter subscribers (PRD §6, §14).
 * Product-agnostic — shared across MDG Labs products via `source`.
 * Unsubscribe uses `unsubscribe_token`; rows are soft-unsubscribed, not deleted.
 */
export const subscribers = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  source: text("source").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  unsubscribeToken: uuid("unsubscribe_token")
    .notNull()
    .unique()
    .defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

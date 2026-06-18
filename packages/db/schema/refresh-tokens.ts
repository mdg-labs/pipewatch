import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

/**
 * DB-backed refresh sessions (PRD §6, §7.1).
 * `user_id` cascades when the user row is deleted.
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

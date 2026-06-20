import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { adminSchema } from "./admin-schema.js";
import { adminUsers } from "./admin-users.js";

/**
 * Admin portal sessions (Admin PRD §7.3).
 */
export const adminSessions = adminSchema.table("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

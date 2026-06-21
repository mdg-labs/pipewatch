import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { adminSchema } from "./admin-schema.js";
import { adminUsers } from "./admin-users.js";

/**
 * One-time password reset tokens for existing admin users (Admin PRD §8).
 */
export const adminPasswordResetTokens = adminSchema.table("admin_password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

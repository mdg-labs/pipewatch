import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { adminSchema } from "./admin-schema.js";

/**
 * Platform operators — separate from product `users` (Admin PRD §7.2).
 */
export const adminUsers = adminSchema.table("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

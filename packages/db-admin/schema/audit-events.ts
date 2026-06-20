import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { adminSchema } from "./admin-schema.js";
import { adminUsers } from "./admin-users.js";

/**
 * Ops audit log for mutating admin actions (Admin PRD §7.5).
 */
export const auditEvents = adminSchema.table("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => adminUsers.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

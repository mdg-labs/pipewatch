import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { adminSchema } from "./admin-schema.js";
import { adminUsers } from "./admin-users.js";

/**
 * Invite-only admin onboarding (Admin PRD §7.4).
 */
export const adminInvites = adminSchema.table("admin_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => adminUsers.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

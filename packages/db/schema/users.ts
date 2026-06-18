import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** GitHub-authenticated user profile (PRD §6). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "bigint" }).notNull().unique(),
  githubLogin: text("github_login").notNull(),
  email: text("email"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

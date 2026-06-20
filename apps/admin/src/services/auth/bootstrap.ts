import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { adminUsers } from "@pipewatch/db-admin/schema";
import { sql } from "drizzle-orm";

import { hashPassword } from "./password.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create the first `platform_admin` when `admin_users` is empty (Admin PRD §8.2).
 * No-op when users already exist or bootstrap env is incomplete.
 */
export async function bootstrapAdminUser(database: Db, env: AdminEnv): Promise<void> {
  const rows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(adminUsers);
  const count = rows[0]?.count ?? 0;

  if (count > 0) {
    return;
  }

  const email = env.ADMIN_BOOTSTRAP_EMAIL;
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    return;
  }

  const passwordHash = await hashPassword(password);

  await database.insert(adminUsers).values({
    email: normalizeEmail(email),
    passwordHash,
    role: "platform_admin",
  });
}

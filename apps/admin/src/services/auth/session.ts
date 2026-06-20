import type { Db } from "@pipewatch/db";
import { adminSessions, adminUsers } from "@pipewatch/db-admin/schema";
import { sha256 } from "@pipewatch/utils";
import { and, eq, gt } from "drizzle-orm";

import type { AdminUser } from "../../types.js";
import { AdminHttpError } from "../../lib/api-error.js";
import { parseAdminRole } from "./roles.js";
import {
  generateOpaqueToken,
  signOpaqueToken,
  verifySignedOpaqueToken,
} from "./session-token.js";

export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SessionCookieOptions = {
  secure: boolean;
  maxAgeSeconds: number;
  path: string;
  httpOnly: true;
  sameSite: "Lax";
};

function hashSessionToken(token: string): string {
  return sha256(token);
}

function toAdminUser(row: {
  id: string;
  email: string;
  role: string;
}): AdminUser {
  return {
    id: row.id,
    email: row.email,
    role: parseAdminRole(row.role),
  };
}

/** Cookie attributes for the admin session (Admin PRD §7.3). */
export function buildSessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    secure,
    maxAgeSeconds: ADMIN_SESSION_TTL_MS / 1000,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  };
}

export type CreatedSession = {
  cookieValue: string;
  sessionId: string;
  user: AdminUser;
};

/** Create a signed session cookie value and persist the hashed token. */
export async function createSession(
  database: Db,
  adminUserId: string,
  sessionSecret: string,
): Promise<CreatedSession> {
  const opaqueToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);

  const [session] = await database
    .insert(adminSessions)
    .values({
      adminUserId,
      tokenHash: hashSessionToken(opaqueToken),
      expiresAt,
    })
    .returning({ id: adminSessions.id });

  if (!session) {
    throw new AdminHttpError("Failed to create session", 500, "INTERNAL_ERROR");
  }

  const [user] = await database
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminUserId))
    .limit(1);

  if (!user) {
    throw new AdminHttpError("Admin user not found", 404, "NOT_FOUND");
  }

  return {
    cookieValue: signOpaqueToken(opaqueToken, sessionSecret),
    sessionId: session.id,
    user: toAdminUser(user),
  };
}

export type ActiveSession = {
  sessionId: string;
  user: AdminUser;
};

/** Resolve a signed cookie value to an active, unexpired session. */
export async function requireActiveSession(
  database: Db,
  signedCookie: string | undefined,
  sessionSecret: string,
): Promise<ActiveSession> {
  if (!signedCookie) {
    throw new AdminHttpError("Authentication required", 401, "UNAUTHORIZED");
  }

  const opaqueToken = verifySignedOpaqueToken(signedCookie, sessionSecret);
  if (!opaqueToken) {
    throw new AdminHttpError("Invalid session", 401, "UNAUTHORIZED");
  }

  const [row] = await database
    .select({
      sessionId: adminSessions.id,
      expiresAt: adminSessions.expiresAt,
      userId: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, hashSessionToken(opaqueToken)),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AdminHttpError("Session expired", 401, "UNAUTHORIZED");
  }

  return {
    sessionId: row.sessionId,
    user: toAdminUser({
      id: row.userId,
      email: row.email,
      role: row.role,
    }),
  };
}

/** Revoke a session row by id. */
export async function revokeSession(database: Db, sessionId: string): Promise<void> {
  await database.delete(adminSessions).where(eq(adminSessions.id, sessionId));
}

/** Touch `last_login_at` after a successful password login. */
export async function recordLogin(database: Db, adminUserId: string): Promise<void> {
  await database
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, adminUserId));
}

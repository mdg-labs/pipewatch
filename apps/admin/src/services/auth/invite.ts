import { randomBytes } from "node:crypto";

import type { Db } from "@pipewatch/db";
import { adminInvites, adminUsers } from "@pipewatch/db-admin/schema";
import { sha256 } from "@pipewatch/utils";
import { and, eq, isNull, sql } from "drizzle-orm";

import { AdminHttpError } from "../../lib/api-error.js";
import { hashPassword } from "../auth/password.js";
import type { AdminRole } from "../../types.js";
import {
  buildAdminInviteUrl,
  sendAdminInviteEmail,
  type EmailTransport,
  type InviteMailEnv,
} from "../mail/invite.js";

const INVITE_EXPIRY_DAYS = 7;

export type AdminInvite = {
  id: string;
  email: string;
  role: AdminRole;
  invited_at: string;
  expires_at: string;
  email_sent: boolean;
  invite_url?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashInviteToken(token: string): string {
  return sha256(token);
}

function toAdminInvite(
  row: {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    expiresAt: Date;
  },
  delivery: { emailSent: boolean; inviteUrl?: string },
): AdminInvite {
  return {
    id: row.id,
    email: row.email,
    role: row.role as AdminRole,
    invited_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
    email_sent: delivery.emailSent,
    ...(delivery.inviteUrl ? { invite_url: delivery.inviteUrl } : {}),
  };
}

/** List pending admin invites (`platform_admin` only). */
export async function listAdminInvites(database: Db): Promise<AdminInvite[]> {
  const rows = await database
    .select({
      id: adminInvites.id,
      email: adminInvites.email,
      role: adminInvites.role,
      createdAt: adminInvites.createdAt,
      expiresAt: adminInvites.expiresAt,
    })
    .from(adminInvites)
    .where(and(isNull(adminInvites.acceptedAt), sql`${adminInvites.expiresAt} > now()`));

  return rows.map((row) => toAdminInvite(row, { emailSent: true }));
}

export type CreateAdminInviteInput = {
  email: string;
  role: AdminRole;
};

/** Create a 7-day admin invite and send email when SMTP is configured. */
export async function createAdminInvite(
  database: Db,
  env: InviteMailEnv,
  invitedBy: string,
  input: CreateAdminInviteInput,
  transport?: EmailTransport,
): Promise<AdminInvite> {
  const email = normalizeEmail(input.email);
  const token = generateInviteToken();
  const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS);

  const [existingUser] = await database
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${email}`)
    .limit(1);

  if (existingUser) {
    throw new AdminHttpError("An admin user with this email already exists", 409, "CONFLICT");
  }

  const [pendingInvite] = await database
    .select({ id: adminInvites.id })
    .from(adminInvites)
    .where(
      and(
        sql`lower(${adminInvites.email}) = ${email}`,
        isNull(adminInvites.acceptedAt),
        sql`${adminInvites.expiresAt} > now()`,
      ),
    )
    .limit(1);

  if (pendingInvite) {
    throw new AdminHttpError("A pending invite already exists for this email", 409, "CONFLICT");
  }

  const [invite] = await database
    .insert(adminInvites)
    .values({
      email,
      role: input.role,
      tokenHash: hashInviteToken(token),
      invitedBy,
      expiresAt,
    })
    .returning({
      id: adminInvites.id,
      email: adminInvites.email,
      role: adminInvites.role,
      createdAt: adminInvites.createdAt,
      expiresAt: adminInvites.expiresAt,
    });

  if (!invite) {
    throw new AdminHttpError("Failed to create invite", 500, "INTERNAL_ERROR");
  }

  const delivery = await sendAdminInviteEmail(env, { to: email, token }, transport);

  return toAdminInvite(invite, delivery);
}

/** Revoke a pending admin invite by id. */
export async function revokeAdminInvite(database: Db, inviteId: string): Promise<void> {
  const [invite] = await database
    .select({ id: adminInvites.id })
    .from(adminInvites)
    .where(and(eq(adminInvites.id, inviteId), isNull(adminInvites.acceptedAt)))
    .limit(1);

  if (!invite) {
    throw new AdminHttpError("Invite not found", 404, "NOT_FOUND");
  }

  await database.delete(adminInvites).where(eq(adminInvites.id, inviteId));
}

export type AcceptAdminInviteInput = {
  token: string;
  password: string;
};

export type AcceptAdminInviteResult = {
  email: string;
  role: AdminRole;
};

/** Accept an invite token, create the admin user, and mark the invite accepted. */
export async function acceptAdminInvite(
  database: Db,
  input: AcceptAdminInviteInput,
): Promise<AcceptAdminInviteResult> {
  const [invite] = await database
    .select({
      id: adminInvites.id,
      email: adminInvites.email,
      role: adminInvites.role,
      acceptedAt: adminInvites.acceptedAt,
      expiresAt: adminInvites.expiresAt,
    })
    .from(adminInvites)
    .where(eq(adminInvites.tokenHash, hashInviteToken(input.token)))
    .limit(1);

  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
    throw new AdminHttpError("Invalid or expired invite", 400, "BAD_REQUEST");
  }

  const passwordHash = await hashPassword(input.password);

  await database.transaction(async (tx) => {
    await tx.insert(adminUsers).values({
      email: invite.email,
      passwordHash,
      role: invite.role,
    });

    await tx
      .update(adminInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(adminInvites.id, invite.id));
  });

  return {
    email: invite.email,
    role: invite.role as AdminRole,
  };
}

export { buildAdminInviteUrl, INVITE_EXPIRY_DAYS };

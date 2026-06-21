import { randomBytes } from "node:crypto";

import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import {
  adminPasswordResetTokens,
  adminSessions,
  adminUsers,
  auditEvents,
} from "@pipewatch/db-admin/schema";
import { sha256 } from "@pipewatch/utils";
import { and, eq, isNull, sql } from "drizzle-orm";

import { AdminHttpError } from "../../lib/api-error.js";
import type { EmailTransport } from "../mail/invite.js";
import {
  buildAdminPasswordResetUrl,
  sendAdminPasswordResetEmail,
  type PasswordResetMailEnv,
} from "../mail/password-reset.js";
import { hashPassword } from "./password.js";

const DEFAULT_RESET_TTL_SECONDS = 3600;

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashResetToken(token: string): string {
  return sha256(token);
}

function resolveResetTtlMs(env: Pick<AdminEnv, "ADMIN_PASSWORD_RESET_TTL_SECONDS">): number {
  const seconds = env.ADMIN_PASSWORD_RESET_TTL_SECONDS ?? DEFAULT_RESET_TTL_SECONDS;
  return seconds * 1000;
}

export type RequestPasswordResetInput = {
  email: string;
};

export type RequestPasswordResetResult = {
  message: string;
  resetUrl?: string;
};

/** Create a one-time reset token for an existing admin user and send email when configured. */
export async function requestPasswordReset(
  database: Db,
  env: PasswordResetMailEnv & Pick<AdminEnv, "ADMIN_PASSWORD_RESET_TTL_SECONDS">,
  input: RequestPasswordResetInput,
  transport?: EmailTransport,
): Promise<RequestPasswordResetResult> {
  const email = normalizeEmail(input.email);

  const [user] = await database
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${email}`)
    .limit(1);

  if (!user) {
    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + resolveResetTtlMs(env));

  await database.transaction(async (tx) => {
    await tx
      .delete(adminPasswordResetTokens)
      .where(
        and(
          eq(adminPasswordResetTokens.adminUserId, user.id),
          isNull(adminPasswordResetTokens.usedAt),
        ),
      );

    await tx.insert(adminPasswordResetTokens).values({
      adminUserId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt,
    });
  });

  const delivery = await sendAdminPasswordResetEmail(
    env,
    { to: user.email, token },
    transport,
  );

  return {
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    ...(delivery.resetUrl ? { resetUrl: delivery.resetUrl } : {}),
  };
}

export type ResetPasswordInput = {
  token: string;
  password: string;
};

/** Reset password from a valid token, invalidate sessions, and record audit event. */
export async function resetPassword(database: Db, input: ResetPasswordInput): Promise<void> {
  const [tokenRow] = await database
    .select({
      id: adminPasswordResetTokens.id,
      adminUserId: adminPasswordResetTokens.adminUserId,
      usedAt: adminPasswordResetTokens.usedAt,
      expiresAt: adminPasswordResetTokens.expiresAt,
    })
    .from(adminPasswordResetTokens)
    .where(eq(adminPasswordResetTokens.tokenHash, hashResetToken(input.token)))
    .limit(1);

  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt.getTime() <= Date.now()) {
    throw new AdminHttpError("Invalid or expired reset token", 400, "BAD_REQUEST");
  }

  const passwordHash = await hashPassword(input.password);

  await database.transaction(async (tx) => {
    const [updated] = await tx
      .update(adminUsers)
      .set({ passwordHash })
      .where(eq(adminUsers.id, tokenRow.adminUserId))
      .returning({ id: adminUsers.id });

    if (!updated) {
      throw new AdminHttpError("Invalid or expired reset token", 400, "BAD_REQUEST");
    }

    await tx
      .update(adminPasswordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(adminPasswordResetTokens.id, tokenRow.id));

    await tx
      .delete(adminSessions)
      .where(eq(adminSessions.adminUserId, tokenRow.adminUserId));

    await tx.insert(auditEvents).values({
      adminUserId: tokenRow.adminUserId,
      action: "admin.password_reset",
      targetType: "admin_user",
      targetId: tokenRow.adminUserId,
    });
  });
}

export { buildAdminPasswordResetUrl, DEFAULT_RESET_TTL_SECONDS };

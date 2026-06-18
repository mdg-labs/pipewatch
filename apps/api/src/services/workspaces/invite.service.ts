import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { users, workspaceInvites, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import type { WorkspaceRole } from "@pipewatch/types";

import {
  sendEmail,
  type EmailTransport,
  type SendEmailEnv,
} from "../email/send-email.js";
import { renderWorkspaceInviteEmail } from "../email/templates/invite.js";
import {
  assertMemberAcceptAllowed,
  assertMemberInviteAllowed,
  PlanLimitError,
} from "../../middleware/plan-limits.js";

const INVITE_EXPIRY_DAYS = 7;

export class InviteError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "InviteError";
    this.status = status;
    this.code = code;
  }
}

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  invited_at: string;
  expires_at: string;
  email_sent: boolean;
  invite_url?: string;
};

export type InvitePreview = {
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string;
};

export type AcceptInviteResult = {
  workspace_id: string;
  workspace_name: string;
  role: WorkspaceRole;
};

export type CreateInviteInput = {
  email: string;
  role: WorkspaceRole;
};

export type InviteServiceEnv = Pick<ApiEnv, "APP_URL" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM">;

function parseRole(role: string): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }

  return "member";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function buildInviteUrl(appUrl: string | undefined, token: string): string {
  const base = appUrl?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}/invite/${token}`;
}

function toWorkspaceInvite(
  row: {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    expiresAt: Date;
  },
  delivery: { emailSent: boolean; inviteUrl?: string },
): WorkspaceInvite {
  return {
    id: row.id,
    email: row.email,
    role: parseRole(row.role),
    invited_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
    email_sent: delivery.emailSent,
    ...(delivery.inviteUrl ? { invite_url: delivery.inviteUrl } : {}),
  };
}

function isInviteActive(row: { acceptedAt: Date | null; expiresAt: Date }): boolean {
  return row.acceptedAt === null && row.expiresAt.getTime() > Date.now();
}

async function getInviterName(database: Db, userId: string): Promise<string | null> {
  const [row] = await database
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.name ?? null;
}

async function deliverInviteEmail(
  env: InviteServiceEnv,
  params: {
    to: string;
    workspaceName: string;
    inviterName: string | null;
    token: string;
  },
  transport?: EmailTransport,
): Promise<{ emailSent: boolean; inviteUrl?: string }> {
  const inviteUrl = buildInviteUrl(env.APP_URL, params.token);
  const rendered = renderWorkspaceInviteEmail({
    workspaceName: params.workspaceName,
    inviterName: params.inviterName,
    inviteUrl,
  });

  const smtpEnv: SendEmailEnv = {
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    SMTP_FROM: env.SMTP_FROM,
  };

  const result = await sendEmail(
    smtpEnv,
    {
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    },
    transport,
  );

  if (result.sent) {
    return { emailSent: true };
  }

  return { emailSent: false, inviteUrl };
}

async function assertInviteeNotMember(
  database: Db,
  workspaceId: string,
  email: string,
): Promise<void> {
  const normalized = normalizeEmail(email);

  const [existingMember] = await database
    .select({ userId: users.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        sql`lower(${users.email}) = ${normalized}`,
        sql`${workspaceMembers.acceptedAt} is not null`,
      ),
    )
    .limit(1);

  if (existingMember) {
    throw new InviteError("User is already a workspace member", 409, "CONFLICT");
  }
}

async function assertNoPendingInvite(
  database: Db,
  workspaceId: string,
  email: string,
): Promise<void> {
  const normalized = normalizeEmail(email);

  const [pending] = await database
    .select({ id: workspaceInvites.id })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        sql`lower(${workspaceInvites.email}) = ${normalized}`,
        isNull(workspaceInvites.acceptedAt),
        sql`${workspaceInvites.expiresAt} > now()`,
      ),
    )
    .limit(1);

  if (pending) {
    throw new InviteError("A pending invite already exists for this email", 409, "CONFLICT");
  }
}

/** List pending workspace invites (PRD §7, pages B9). */
export async function listWorkspaceInvites(
  database: Db,
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const rows = await database
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      createdAt: workspaceInvites.createdAt,
      expiresAt: workspaceInvites.expiresAt,
    })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
      ),
    );

  return rows.map((row) => toWorkspaceInvite(row, { emailSent: true }));
}

/** Create a workspace invite with 7-day expiry and optional SMTP delivery (PRD §7, §21). */
export async function createWorkspaceInvite(
  database: Db,
  env: InviteServiceEnv,
  workspaceId: string,
  createdBy: string,
  input: CreateInviteInput,
  transport?: EmailTransport,
): Promise<WorkspaceInvite> {
  const email = normalizeEmail(input.email);

  try {
    await assertMemberInviteAllowed(database, workspaceId);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new InviteError(error.message, error.status, error.code);
    }

    throw error;
  }

  await assertInviteeNotMember(database, workspaceId, email);
  await assertNoPendingInvite(database, workspaceId, email);

  const token = randomUUID();
  const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS);

  const [workspace] = await database
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new InviteError("Workspace not found", 404, "NOT_FOUND");
  }

  const [invite] = await database
    .insert(workspaceInvites)
    .values({
      workspaceId,
      createdBy,
      email,
      role: input.role,
      token,
      expiresAt,
    })
    .returning({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      createdAt: workspaceInvites.createdAt,
      expiresAt: workspaceInvites.expiresAt,
    });

  if (!invite) {
    throw new InviteError("Failed to create invite", 500, "INTERNAL_ERROR");
  }

  const inviterName = await getInviterName(database, createdBy);
  const delivery = await deliverInviteEmail(
    env,
    {
      to: email,
      workspaceName: workspace.name,
      inviterName,
      token,
    },
    transport,
  );

  return toWorkspaceInvite(invite, delivery);
}

/** Revoke a pending workspace invite. */
export async function revokeWorkspaceInvite(
  database: Db,
  workspaceId: string,
  inviteId: string,
): Promise<void> {
  const [deleted] = await database
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
      ),
    )
    .returning({ id: workspaceInvites.id });

  if (!deleted) {
    throw new InviteError("Invite not found", 404, "NOT_FOUND");
  }
}

/** Re-send invite email or return the invite link when SMTP is unset. */
export async function resendWorkspaceInvite(
  database: Db,
  env: InviteServiceEnv,
  workspaceId: string,
  inviteId: string,
  transport?: EmailTransport,
): Promise<WorkspaceInvite> {
  const [invite] = await database
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      createdAt: workspaceInvites.createdAt,
      expiresAt: workspaceInvites.expiresAt,
      acceptedAt: workspaceInvites.acceptedAt,
      workspaceName: workspaces.name,
      createdBy: workspaceInvites.createdBy,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!invite) {
    throw new InviteError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.acceptedAt !== null) {
    throw new InviteError("Invite has already been accepted", 409, "CONFLICT");
  }

  if (!isInviteActive(invite)) {
    throw new InviteError("Invite has expired", 410, "GONE");
  }

  const inviterName = await getInviterName(database, invite.createdBy);
  const delivery = await deliverInviteEmail(
    env,
    {
      to: invite.email,
      workspaceName: invite.workspaceName,
      inviterName,
      token: invite.token,
    },
    transport,
  );

  return toWorkspaceInvite(invite, delivery);
}

/** Public invite validation — token must be pending and not expired (pages B18). */
export async function getInvitePreview(
  database: Db,
  token: string,
): Promise<InvitePreview> {
  const [invite] = await database
    .select({
      workspaceId: workspaceInvites.workspaceId,
      workspaceName: workspaces.name,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      expiresAt: workspaceInvites.expiresAt,
      acceptedAt: workspaceInvites.acceptedAt,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
    .where(eq(workspaceInvites.token, token))
    .limit(1);

  if (!invite) {
    throw new InviteError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.acceptedAt !== null) {
    throw new InviteError("Invite has already been accepted", 409, "CONFLICT");
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new InviteError("Invite has expired", 410, "GONE");
  }

  return {
    workspace_id: invite.workspaceId,
    workspace_name: invite.workspaceName,
    email: invite.email,
    role: parseRole(invite.role),
    expires_at: invite.expiresAt.toISOString(),
  };
}

/** Accept an invite — creates membership and marks invite accepted (PRD §7). */
export async function acceptWorkspaceInvite(
  database: Db,
  token: string,
  userId: string,
): Promise<AcceptInviteResult> {
  const [invite] = await database
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      workspaceName: workspaces.name,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      expiresAt: workspaceInvites.expiresAt,
      acceptedAt: workspaceInvites.acceptedAt,
      createdAt: workspaceInvites.createdAt,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
    .where(eq(workspaceInvites.token, token))
    .limit(1);

  if (!invite) {
    throw new InviteError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.acceptedAt !== null) {
    throw new InviteError("Invite has already been accepted", 409, "CONFLICT");
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new InviteError("Invite has expired", 410, "GONE");
  }

  const [user] = await database
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.email) {
    throw new InviteError("Authenticated user has no email on file", 403, "FORBIDDEN");
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
    throw new InviteError("Invite email does not match signed-in user", 403, "FORBIDDEN");
  }

  const [existingMembership] = await database
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, userId),
        sql`${workspaceMembers.acceptedAt} is not null`,
      ),
    )
    .limit(1);

  if (existingMembership) {
    throw new InviteError("User is already a workspace member", 409, "CONFLICT");
  }

  try {
    await assertMemberAcceptAllowed(database, invite.workspaceId);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new InviteError(error.message, error.status, error.code);
    }

    throw error;
  }

  await database.transaction(async (tx) => {
    await tx.insert(workspaceMembers).values({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      invitedAt: invite.createdAt,
      acceptedAt: new Date(),
    });

    await tx
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.id));
  });

  return {
    workspace_id: invite.workspaceId,
    workspace_name: invite.workspaceName,
    role: parseRole(invite.role),
  };
}

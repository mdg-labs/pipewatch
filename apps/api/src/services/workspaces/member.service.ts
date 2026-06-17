import { and, count, eq, isNotNull } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { users, workspaceMembers } from "@pipewatch/db/schema";
import type { UpdateWorkspaceMemberInput, WorkspaceMember, WorkspaceRole } from "@pipewatch/types";

export class MemberError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "MemberError";
    this.status = status;
    this.code = code;
  }
}

function parseRole(role: string): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }

  return "member";
}

function toWorkspaceMember(row: {
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  acceptedAt: Date | null;
}): WorkspaceMember {
  return {
    user_id: row.userId,
    name: row.name,
    email: row.email,
    avatar_url: row.avatarUrl,
    role: parseRole(row.role),
    joined_at: (row.acceptedAt ?? new Date()).toISOString(),
  };
}

async function countOwners(database: Db, workspaceId: string): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    );

  return row?.total ?? 0;
}

async function getAcceptedMembership(
  database: Db,
  workspaceId: string,
  userId: string,
): Promise<{ role: WorkspaceRole } | null> {
  const [row] = await database
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return { role: parseRole(row.role) };
}

/** List accepted workspace members with profile fields (PRD §7, pages B9). */
export async function listWorkspaceMembers(
  database: Db,
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const rows = await database
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
      acceptedAt: workspaceMembers.acceptedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    );

  return rows.map(toWorkspaceMember);
}

/** Change a member's role. Blocks demoting the last owner. */
export async function updateMemberRole(
  database: Db,
  workspaceId: string,
  targetUserId: string,
  input: UpdateWorkspaceMemberInput,
): Promise<WorkspaceMember> {
  const membership = await getAcceptedMembership(database, workspaceId, targetUserId);

  if (!membership) {
    throw new MemberError("Member not found", 404, "NOT_FOUND");
  }

  if (membership.role === "owner" && input.role !== "owner") {
    const owners = await countOwners(database, workspaceId);
    if (owners <= 1) {
      throw new MemberError("Cannot demote the last workspace owner", 409, "CONFLICT");
    }
  }

  const [updated] = await database
    .update(workspaceMembers)
    .set({ role: input.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    )
    .returning({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      acceptedAt: workspaceMembers.acceptedAt,
    });

  if (!updated) {
    throw new MemberError("Member not found", 404, "NOT_FOUND");
  }

  const [profile] = await database
    .select({
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!profile) {
    throw new MemberError("Member not found", 404, "NOT_FOUND");
  }

  return toWorkspaceMember({
    userId: updated.userId,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    role: updated.role,
    acceptedAt: updated.acceptedAt,
  });
}

/** Remove a member from the workspace. Blocks removing the last owner. */
export async function removeMember(
  database: Db,
  workspaceId: string,
  targetUserId: string,
): Promise<void> {
  const membership = await getAcceptedMembership(database, workspaceId, targetUserId);

  if (!membership) {
    throw new MemberError("Member not found", 404, "NOT_FOUND");
  }

  if (membership.role === "owner") {
    const owners = await countOwners(database, workspaceId);
    if (owners <= 1) {
      throw new MemberError("Cannot remove the last workspace owner", 409, "CONFLICT");
    }
  }

  const [deleted] = await database
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    )
    .returning({ id: workspaceMembers.id });

  if (!deleted) {
    throw new MemberError("Member not found", 404, "NOT_FOUND");
  }
}

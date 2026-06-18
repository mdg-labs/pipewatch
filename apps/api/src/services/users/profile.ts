import { and, eq, isNotNull } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { users, workspaceMembers } from "@pipewatch/db/schema";
import type { UpdateUserProfileInput, UserProfile } from "@pipewatch/types";

import { revokeAllUserRefreshTokens } from "../auth/refresh-token.js";

export class ProfileError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ProfileError";
    this.status = status;
    this.code = code;
  }
}

function toUserProfile(row: typeof users.$inferSelect): UserProfile {
  return {
    name: row.name,
    email: row.email,
    avatar_url: row.avatarUrl,
    github_login: row.githubLogin,
  };
}

/** Load the authenticated user's profile. */
export async function getUserProfile(
  database: Db,
  userId: string,
): Promise<UserProfile | null> {
  const [row] = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return toUserProfile(row);
}

/** Update the user's display name (`users.name` only). */
export async function updateUserProfile(
  database: Db,
  userId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile | null> {
  const [row] = await database
    .update(users)
    .set({
      name: input.name,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!row) {
    return null;
  }

  return toUserProfile(row);
}

/**
 * True when the user is the sole accepted owner of a workspace that still has
 * other accepted members (account delete must be blocked — PRD §6, pages B13).
 */
export async function isAccountDeleteBlocked(
  database: Db,
  userId: string,
): Promise<boolean> {
  const ownedWorkspaces = await database
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.role, "owner"),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    );

  for (const { workspaceId } of ownedWorkspaces) {
    const members = await database
      .select({ memberUserId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          isNotNull(workspaceMembers.acceptedAt),
        ),
      );

    const otherMembers = members.filter((member) => member.memberUserId !== userId);
    if (otherMembers.length === 0) {
      continue;
    }

    const hasOtherOwner = otherMembers.some((member) => member.role === "owner");
    if (!hasOtherOwner) {
      return true;
    }
  }

  return false;
}

/**
 * Revoke all refresh tokens and delete the user row (FK cascades memberships, etc.).
 */
export async function deleteUserAccount(database: Db, userId: string): Promise<void> {
  const blocked = await isAccountDeleteBlocked(database, userId);
  if (blocked) {
    throw new ProfileError(
      "Cannot delete account while you are the sole owner of a workspace with other members",
      409,
      "CONFLICT",
    );
  }

  await database.transaction(async (tx) => {
    await revokeAllUserRefreshTokens(tx, userId);
    await tx.delete(users).where(eq(users.id, userId));
  });
}

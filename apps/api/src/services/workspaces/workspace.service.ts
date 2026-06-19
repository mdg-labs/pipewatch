import { flags } from "@pipewatch/config/edition";
import { and, count, eq, isNotNull, ne } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { workspaceMembers, workspaces } from "@pipewatch/db/schema";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceListItem,
  WorkspacePlan,
} from "@pipewatch/types";

import {
  assertWorkspaceCreateAllowed,
  PlanLimitError,
  resolveWorkspaceRetentionForPatch,
} from "../../middleware/plan-limits.js";

/** Lowercase URL slug: letters, digits, hyphens; no leading/trailing hyphen. */
export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SLUG_MAX_LENGTH = 64;

export class WorkspaceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "WorkspaceError";
    this.status = status;
    this.code = code;
  }
}

function toWorkspace(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: parseWorkspacePlan(row.plan),
    default_retention_days: row.defaultRetentionDays,
    created_at: row.createdAt.toISOString(),
  };
}

function parseWorkspacePlan(plan: string): WorkspacePlan {
  if (plan === "pro" || plan === "business") {
    return plan;
  }

  return "free";
}

/** Derive a URL-safe slug from a display name (pages B2, B8). */
export function slugifyWorkspaceName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH);

  return base.length > 0 ? base : "workspace";
}

export function validateSlugFormat(slug: string): boolean {
  return (
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LENGTH &&
    WORKSPACE_SLUG_PATTERN.test(slug)
  );
}

async function isSlugTaken(
  database: Db,
  slug: string,
  excludeWorkspaceId?: string,
): Promise<boolean> {
  const conditions = [eq(workspaces.slug, slug)];

  if (excludeWorkspaceId) {
    conditions.push(ne(workspaces.id, excludeWorkspaceId));
  }

  const [row] = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(...conditions))
    .limit(1);

  return row !== undefined;
}

/** Resolve a unique slug, appending numeric suffixes on collision. */
export async function resolveUniqueSlug(
  database: Db,
  preferredSlug: string,
  excludeWorkspaceId?: string,
): Promise<string> {
  if (!validateSlugFormat(preferredSlug)) {
    throw new WorkspaceError("Invalid slug format", 422, "VALIDATION_ERROR");
  }

  let candidate = preferredSlug;
  let suffix = 2;

  while (await isSlugTaken(database, candidate, excludeWorkspaceId)) {
    const suffixText = `-${String(suffix)}`;
    const trimmedBase = preferredSlug.slice(0, SLUG_MAX_LENGTH - suffixText.length);
    candidate = `${trimmedBase}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

/** Check whether a slug is available (public endpoint). */
export async function checkSlugAvailability(
  database: Db,
  slug: string,
  excludeWorkspaceId?: string,
): Promise<{ available: boolean; slug: string }> {
  if (!validateSlugFormat(slug)) {
    throw new WorkspaceError("Invalid slug format", 422, "VALIDATION_ERROR");
  }

  const taken = await isSlugTaken(database, slug, excludeWorkspaceId);
  return { available: !taken, slug };
}

async function countMemberWorkspaces(database: Db, userId: string): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), isNotNull(workspaceMembers.acceptedAt)));

  return row?.total ?? 0;
}

async function assertCanCreateWorkspace(database: Db, userId: string): Promise<void> {
  if (!flags.MULTI_WORKSPACE_ENABLED) {
    const memberCount = await countMemberWorkspaces(database, userId);
    if (memberCount >= 1) {
      throw new WorkspaceError(
        "Only one workspace is allowed in this edition",
        403,
        "FORBIDDEN",
      );
    }

    return;
  }

  try {
    await assertWorkspaceCreateAllowed(database, userId);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new WorkspaceError(error.message, error.status, error.code);
    }

    throw error;
  }
}

function validateRetentionUpdate(plan: WorkspacePlan, days: number | undefined): number | undefined {
  try {
    return resolveWorkspaceRetentionForPatch(plan, days);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new WorkspaceError(error.message, error.status, error.code);
    }

    throw error;
  }
}

/** List workspaces the user belongs to (accepted membership). */
export async function listWorkspacesForUser(
  database: Db,
  userId: string,
): Promise<WorkspaceListItem[]> {
  const rows = await database
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), isNotNull(workspaceMembers.acceptedAt)));

  return rows.map((row) => ({
    ...toWorkspace(row.workspace),
    role:
      row.role === "owner" || row.role === "admin" || row.role === "member"
        ? row.role
        : "member",
  }));
}

/** Load a workspace when the user has accepted membership. */
export async function getWorkspaceForMember(
  database: Db,
  userId: string,
  workspaceId: string,
): Promise<Workspace | null> {
  const [row] = await database
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
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

  return toWorkspace(row.workspace);
}

/** Create a workspace and assign the creator as owner. */
export async function createWorkspace(
  database: Db,
  userId: string,
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  const trimmedName = input.name.trim();
  if (trimmedName.length === 0) {
    throw new WorkspaceError("Workspace name is required", 422, "VALIDATION_ERROR");
  }

  await assertCanCreateWorkspace(database, userId);

  const baseSlug = input.slug?.trim() ?? slugifyWorkspaceName(trimmedName);
  const slug = await resolveUniqueSlug(database, baseSlug);

  return database.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: trimmedName,
        slug,
        plan: "free",
        defaultRetentionDays: 30,
      })
      .returning();

    if (!workspace) {
      throw new WorkspaceError("Failed to create workspace", 500, "INTERNAL_ERROR");
    }

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: "owner",
      acceptedAt: new Date(),
    });

    return toWorkspace(workspace);
  });
}

/** Update workspace settings (admin/owner). */
export async function updateWorkspace(
  database: Db,
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<Workspace | null> {
  const [existing] = await database
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const plan = parseWorkspacePlan(existing.plan);
  const updates: Partial<typeof workspaces.$inferInsert> = {};

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (trimmedName.length === 0) {
      throw new WorkspaceError("Workspace name is required", 422, "VALIDATION_ERROR");
    }

    updates.name = trimmedName;
  }

  if (input.slug !== undefined) {
    const trimmedSlug = input.slug.trim();
    if (!validateSlugFormat(trimmedSlug)) {
      throw new WorkspaceError("Invalid slug format", 422, "VALIDATION_ERROR");
    }

    if (await isSlugTaken(database, trimmedSlug, workspaceId)) {
      throw new WorkspaceError("Slug is already taken", 409, "CONFLICT");
    }

    updates.slug = trimmedSlug;
  }

  const retentionDays = validateRetentionUpdate(plan, input.default_retention_days);
  if (retentionDays !== undefined) {
    updates.defaultRetentionDays = retentionDays;
  }

  if (Object.keys(updates).length === 0) {
    return toWorkspace(existing);
  }

  const [updated] = await database
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, workspaceId))
    .returning();

  if (!updated) {
    return null;
  }

  return toWorkspace(updated);
}

/** Delete a workspace (owner only). Blocks CE delete of the user's only workspace. */
export async function deleteWorkspace(
  database: Db,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const [existing] = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!existing) {
    throw new WorkspaceError("Workspace not found", 404, "NOT_FOUND");
  }

  if (!flags.MULTI_WORKSPACE_ENABLED) {
    const memberCount = await countMemberWorkspaces(database, userId);
    if (memberCount <= 1) {
      throw new WorkspaceError(
        "Cannot delete your only workspace in this edition",
        409,
        "CONFLICT",
      );
    }
  }

  await database.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

/** Count workspaces for diagnostics/tests. */
export async function countWorkspaces(database: Db): Promise<number> {
  const [row] = await database.select({ total: count() }).from(workspaces);
  return row?.total ?? 0;
}

/** Ensure slug uniqueness constraints are enforced at DB level. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  while (typeof current === "object" && current !== null) {
    if ("code" in current && (current as { code: string }).code === "23505") {
      return true;
    }

    current = "cause" in current ? (current as { cause: unknown }).cause : undefined;
  }

  return false;
}

export async function createWorkspaceSafe(
  database: Db,
  userId: string,
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  try {
    return await createWorkspace(database, userId, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new WorkspaceError("Slug is already taken", 409, "CONFLICT");
    }

    throw error;
  }
}

export async function updateWorkspaceSafe(
  database: Db,
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<Workspace | null> {
  try {
    return await updateWorkspace(database, workspaceId, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new WorkspaceError("Slug is already taken", 409, "CONFLICT");
    }

    throw error;
  }
}

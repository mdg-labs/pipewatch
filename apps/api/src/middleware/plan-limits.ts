import { flags } from "@pipewatch/config/edition";
import {
  clampRetentionToPlan,
  getPlanLimits,
  parseWorkspacePlan,
} from "@pipewatch/config/plan-limits";
import { and, count, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import {
  repositories,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import type { WorkspacePlan } from "@pipewatch/types";

export class PlanLimitError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PlanLimitError";
    this.status = status;
    this.code = code;
  }
}

async function loadWorkspacePlan(database: Db, workspaceId: string): Promise<WorkspacePlan> {
  const [row] = await database
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!row) {
    throw new PlanLimitError("Workspace not found", 404, "NOT_FOUND");
  }

  return parseWorkspacePlan(row.plan);
}

async function countOwnedWorkspaces(database: Db, userId: string): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.role, "owner"),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    );

  return row?.total ?? 0;
}

async function resolveUserWorkspaceLimit(database: Db, userId: string): Promise<number | null> {
  const ownedPlans = await database
    .select({ plan: workspaces.plan })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.role, "owner"),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    );

  if (ownedPlans.length === 0) {
    return getPlanLimits("free").workspaceLimit;
  }

  let bestLimit: number | null = getPlanLimits("free").workspaceLimit;

  for (const { plan } of ownedPlans) {
    const planLimit = getPlanLimits(parseWorkspacePlan(plan)).workspaceLimit;
    if (planLimit === null) {
      return null;
    }

    if (planLimit > (bestLimit ?? 0)) {
      bestLimit = planLimit;
    }
  }

  return bestLimit;
}

/** Hard 403 when cloud workspace cap is reached (PRD §8, §24). */
export async function assertWorkspaceCreateAllowed(database: Db, userId: string): Promise<void> {
  if (!flags.PLAN_LIMITS_ENABLED) {
    return;
  }

  const ownedCount = await countOwnedWorkspaces(database, userId);
  const limit = await resolveUserWorkspaceLimit(database, userId);

  if (limit !== null && ownedCount >= limit) {
    throw new PlanLimitError("Workspace limit reached for your plan", 403, "FORBIDDEN");
  }
}

async function countEnabledRepositories(
  database: Db,
  workspaceId: string,
  excludeRepoId?: string,
): Promise<number> {
  const conditions = [
    eq(repositories.workspaceId, workspaceId),
    eq(repositories.enabled, true),
  ];

  if (excludeRepoId) {
    conditions.push(ne(repositories.id, excludeRepoId));
  }

  const [row] = await database
    .select({ total: count() })
    .from(repositories)
    .where(and(...conditions));

  return row?.total ?? 0;
}

/** Hard 403 when enabling a repo would exceed the plan cap (PRD §8, §24). */
export async function assertRepoEnableAllowed(
  database: Db,
  workspaceId: string,
  excludeRepoId?: string,
): Promise<void> {
  if (!flags.PLAN_LIMITS_ENABLED) {
    return;
  }

  const plan = await loadWorkspacePlan(database, workspaceId);
  const limit = getPlanLimits(plan).repoLimit;

  if (limit === null) {
    return;
  }

  const enabledCount = await countEnabledRepositories(database, workspaceId, excludeRepoId);

  if (enabledCount >= limit) {
    throw new PlanLimitError("Repository limit reached for your plan", 403, "FORBIDDEN");
  }
}

async function countWorkspaceSeats(database: Db, workspaceId: string): Promise<number> {
  const [memberRow] = await database
    .select({ total: count() })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), isNotNull(workspaceMembers.acceptedAt)),
    );

  const [inviteRow] = await database
    .select({ total: count() })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
        sql`${workspaceInvites.expiresAt} > now()`,
      ),
    );

  return (memberRow?.total ?? 0) + (inviteRow?.total ?? 0);
}

/** Hard 403 when accepting an invite would exceed the plan member cap. */
export async function assertMemberAcceptAllowed(database: Db, workspaceId: string): Promise<void> {
  if (!flags.PLAN_LIMITS_ENABLED) {
    return;
  }

  const plan = await loadWorkspacePlan(database, workspaceId);
  const limit = getPlanLimits(plan).memberLimit;

  if (limit === null) {
    return;
  }

  const [memberRow] = await database
    .select({ total: count() })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), isNotNull(workspaceMembers.acceptedAt)),
    );

  const memberCount = memberRow?.total ?? 0;

  if (memberCount >= limit) {
    throw new PlanLimitError("Member limit reached for your plan", 403, "FORBIDDEN");
  }
}

/** Hard 403 when inviting would exceed the plan member cap (PRD §8). */
export async function assertMemberInviteAllowed(database: Db, workspaceId: string): Promise<void> {
  if (!flags.PLAN_LIMITS_ENABLED) {
    return;
  }

  const plan = await loadWorkspacePlan(database, workspaceId);
  const limit = getPlanLimits(plan).memberLimit;

  if (limit === null) {
    return;
  }

  const seatCount = await countWorkspaceSeats(database, workspaceId);

  if (seatCount >= limit) {
    throw new PlanLimitError("Member limit reached for your plan", 403, "FORBIDDEN");
  }
}

function validateRetentionMinimum(plan: WorkspacePlan, days: number): void {
  const { minRetentionDays } = getPlanLimits(plan);

  if (days < minRetentionDays) {
    throw new PlanLimitError(
      `retention_days must be at least ${String(minRetentionDays)} for your plan`,
      422,
      "VALIDATION_ERROR",
    );
  }
}

/** Clamp retention to plan ceiling on PATCH — PRD §24. CE returns input unchanged. */
export function resolveRetentionDaysForPatch(
  plan: WorkspacePlan,
  days: number | null | undefined,
): number | null | undefined {
  if (days === undefined) {
    return undefined;
  }

  if (days === null) {
    return null;
  }

  if (!Number.isInteger(days) || days < 1) {
    throw new PlanLimitError(
      "retention_days must be a positive integer or null",
      422,
      "VALIDATION_ERROR",
    );
  }

  if (!flags.RETENTION_CEILING) {
    return days;
  }

  validateRetentionMinimum(plan, days);
  return clampRetentionToPlan(plan, days);
}

/** Clamp workspace default retention on PATCH — PRD §24. */
export function resolveWorkspaceRetentionForPatch(
  plan: WorkspacePlan,
  days: number | undefined,
): number | undefined {
  if (days === undefined) {
    return undefined;
  }

  if (!Number.isInteger(days) || days < 1) {
    throw new PlanLimitError(
      "default_retention_days must be a positive integer",
      422,
      "VALIDATION_ERROR",
    );
  }

  if (!flags.RETENTION_CEILING) {
    return days;
  }

  validateRetentionMinimum(plan, days);
  return clampRetentionToPlan(plan, days);
}

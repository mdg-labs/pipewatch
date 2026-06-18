export type WorkspacePlan = "free" | "pro" | "business";

export type PlanLimits = {
  workspaceLimit: number | null;
  repoLimit: number | null;
  memberLimit: number | null;
  maxRetentionDays: number;
  minRetentionDays: number;
};

/** Per-plan caps from PRD §8 — `null` means unlimited. */
export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  free: {
    workspaceLimit: 1,
    repoLimit: 10,
    memberLimit: 1,
    maxRetentionDays: 30,
    minRetentionDays: 30,
  },
  pro: {
    workspaceLimit: 3,
    repoLimit: 50,
    memberLimit: 5,
    maxRetentionDays: 365,
    minRetentionDays: 30,
  },
  business: {
    workspaceLimit: null,
    repoLimit: null,
    memberLimit: null,
    maxRetentionDays: 365,
    minRetentionDays: 30,
  },
};

export function parseWorkspacePlan(plan: string): WorkspacePlan {
  if (plan === "pro" || plan === "business") {
    return plan;
  }

  return "free";
}

export function getPlanLimits(plan: WorkspacePlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** Upper-bound clamp for retention PATCH — PRD §24, Decision #26. */
export function clampRetentionToPlan(plan: WorkspacePlan, days: number): number {
  const limits = getPlanLimits(plan);
  return Math.min(days, limits.maxRetentionDays);
}

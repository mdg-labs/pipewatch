import { z } from "zod";

import type { AdminRole } from "../../types.js";

const ADMIN_ROLES = ["viewer", "operator", "platform_admin"] as const;

export const AdminRoleSchema = z.enum(ADMIN_ROLES);

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  operator: 2,
  platform_admin: 3,
};

/** Parse a stored role string or throw when invalid. */
export function parseAdminRole(role: string): AdminRole {
  if ((ADMIN_ROLES as readonly string[]).includes(role)) {
    return role as AdminRole;
  }

  throw new Error(`Invalid admin role: ${role}`);
}

/** True when `role` meets or exceeds `minimum` in the platform hierarchy. */
export function roleMeetsMinimum(role: AdminRole, minimum: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

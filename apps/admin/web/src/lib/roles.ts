import type { AdminRole } from "../api/types.js";

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  operator: 2,
  platform_admin: 3,
};

/** True when `role` meets or exceeds `minimum` in the platform hierarchy. */
export function roleMeetsMinimum(role: AdminRole, minimum: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function formatAdminRole(role: AdminRole): string {
  switch (role) {
    case "viewer":
      return "Viewer";
    case "operator":
      return "Operator";
    case "platform_admin":
      return "Platform admin";
  }
}

import type { ReactNode } from "react";

import { useAuth } from "../hooks/use-auth.js";
import type { AdminRole } from "../api/types.js";
import { roleMeetsMinimum } from "../lib/roles.js";

type RequireRoleProps = {
  minimum: AdminRole;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Hide role-gated UI when the signed-in operator lacks permission. */
export function RequireRole({
  minimum,
  children,
  fallback = null,
}: RequireRoleProps) {
  const { user } = useAuth();

  if (!user || !roleMeetsMinimum(user.role, minimum)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

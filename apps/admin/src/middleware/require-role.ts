import type { MiddlewareHandler } from "hono";

import { AdminHttpError } from "../lib/api-error.js";
import { roleMeetsMinimum } from "../services/auth/roles.js";
import type { AdminAppBindings, AdminRole } from "../types.js";

/** Enforce a minimum platform role on a route (Admin PRD §8.1). */
export function requireRole(minimum: AdminRole): MiddlewareHandler<AdminAppBindings> {
  return async (c, next) => {
    const user = c.get("adminUser");
    if (!roleMeetsMinimum(user.role, minimum)) {
      throw new AdminHttpError("Insufficient permissions", 403, "FORBIDDEN");
    }

    await next();
  };
}

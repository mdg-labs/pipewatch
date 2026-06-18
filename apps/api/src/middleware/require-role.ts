import type { MiddlewareHandler } from "hono";

import { getWorkspaceContext, roleMeetsMinimum } from "../lib/workspace-context.js";
import { apiError } from "./error-handler.js";
import type { ApiEnv } from "../types.js";

/**
 * Require a minimum workspace role for write routes (PRD §5).
 * `requireRole('admin')` allows admin and owner; `requireRole('owner')` is owner-only.
 */
export function requireRole(minimumRole: "admin" | "owner"): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, minimumRole)) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    await next();
  };
}

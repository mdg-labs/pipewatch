import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import type { MiddlewareHandler } from "hono";

import {
  buildWorkspaceContext,
  resolveAuthIdentity,
  setWorkspaceContext,
} from "../lib/workspace-context.js";
import { requireJwtSecret } from "../routes/auth/shared.js";
import { apiError } from "./error-handler.js";
import type { ApiEnv } from "../types.js";

export type WorkspaceScopeDeps = {
  env: ParsedApiEnv;
  db: Db;
};

/**
 * Resolve workspace context from JWT `workspaceId` or API key scope and enforce
 * membership for browser sessions (PRD §5, §7.1).
 */
export function workspaceScope(deps: WorkspaceScopeDeps): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const routeWorkspaceId = c.req.param("workspaceId");
    if (!routeWorkspaceId) {
      return c.json(apiError("BAD_REQUEST", "Workspace ID is required"), 400);
    }

    const jwtSecret = requireJwtSecret(deps.env);
    const identity = await resolveAuthIdentity(
      deps.db,
      c.req.header("Authorization"),
      jwtSecret,
    );

    if (!identity) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const context = await buildWorkspaceContext(deps.db, identity, routeWorkspaceId);

    if (context === "forbidden") {
      return c.json(apiError("FORBIDDEN", "Access to this workspace is forbidden"), 403);
    }

    setWorkspaceContext(c, context);
    await next();
  };
}

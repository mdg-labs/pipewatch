import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

import { AdminHttpError } from "../lib/api-error.js";
import { requireActiveSession } from "../services/auth/session.js";
import { ADMIN_SESSION_COOKIE } from "../services/auth/session-token.js";
import type { AdminAppBindings } from "../types.js";

/** Require a valid admin session on protected `/api/*` routes (Admin PRD §8.4). */
export function sessionMiddleware(): MiddlewareHandler<AdminAppBindings> {
  return async (c, next) => {
    const secret = c.get("env").ADMIN_SESSION_SECRET;
    if (!secret) {
      throw new AdminHttpError("Admin session secret is not configured", 500, "INTERNAL_ERROR");
    }

    const cookie = getCookie(c, ADMIN_SESSION_COOKIE);
    const active = await requireActiveSession(c.get("db"), cookie, secret);

    c.set("adminUser", active.user);
    c.set("sessionId", active.sessionId);

    await next();
  };
}

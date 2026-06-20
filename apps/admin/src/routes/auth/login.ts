import type { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";

import { AdminHttpError } from "../../lib/api-error.js";
import { verifyPassword } from "../../services/auth/password.js";
import {
  buildSessionCookieOptions,
  createSession,
  recordLogin,
  revokeSession,
} from "../../services/auth/session.js";
import { ADMIN_SESSION_COOKIE } from "../../services/auth/session-token.js";
import type { AdminAppBindings } from "../../types.js";
import { adminUsers } from "@pipewatch/db-admin/schema";
import { sql } from "drizzle-orm";

const LoginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function isSecureCookie(nodeEnv: string): boolean {
  return nodeEnv === "production" || nodeEnv === "staging";
}

/** POST /api/auth/login — email + password → session cookie. */
export function registerLoginRoute(app: Hono<AdminAppBindings>): void {
  app.post("/auth/login", async (c) => {
    const body = LoginBodySchema.parse(await c.req.json());
    const env = c.get("env");
    const secret = env.ADMIN_SESSION_SECRET;

    if (!secret) {
      throw new AdminHttpError("Admin session secret is not configured", 500, "INTERNAL_ERROR");
    }

    const normalizedEmail = body.email.trim().toLowerCase();

    const [user] = await c
      .get("db")
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        passwordHash: adminUsers.passwordHash,
      })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${normalizedEmail}`)
      .limit(1);

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AdminHttpError("Invalid email or password", 401, "UNAUTHORIZED");
    }

    const session = await createSession(c.get("db"), user.id, secret);
    await recordLogin(c.get("db"), user.id);

    const cookieOptions = buildSessionCookieOptions(isSecureCookie(env.NODE_ENV));
    setCookie(c, ADMIN_SESSION_COOKIE, session.cookieValue, cookieOptions);

    return c.json(
      {
        user: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
        },
      },
      200,
    );
  });
}

/** POST /api/auth/logout — revoke the active session and clear the cookie. */
export function registerLogoutRoute(app: Hono<AdminAppBindings>): void {
  app.post("/auth/logout", async (c) => {
    await revokeSession(c.get("db"), c.get("sessionId"));

    const cookieOptions = buildSessionCookieOptions(isSecureCookie(c.get("env").NODE_ENV));
    deleteCookie(c, ADMIN_SESSION_COOKIE, cookieOptions);

    return c.body(null, 204);
  });
}

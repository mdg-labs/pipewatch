import type { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";

import { AdminHttpError } from "../../lib/api-error.js";
import { acceptAdminInvite } from "../../services/auth/invite.js";
import {
  buildSessionCookieOptions,
  createSession,
} from "../../services/auth/session.js";
import { ADMIN_SESSION_COOKIE } from "../../services/auth/session-token.js";
import type { AdminAppBindings } from "../../types.js";
import { adminUsers } from "@pipewatch/db-admin/schema";
import { eq } from "drizzle-orm";

const AcceptInviteBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

function isSecureCookie(nodeEnv: string): boolean {
  return nodeEnv === "production" || nodeEnv === "staging";
}

/** POST /api/auth/accept-invite — set password from invite token and start a session. */
export function registerAcceptInviteRoute(app: Hono<AdminAppBindings>): void {
  app.post("/auth/accept-invite", async (c) => {
    const body = AcceptInviteBodySchema.parse(await c.req.json());
    const env = c.get("env");
    const secret = env.ADMIN_SESSION_SECRET;

    if (!secret) {
      throw new AdminHttpError("Admin session secret is not configured", 500, "INTERNAL_ERROR");
    }

    const accepted = await acceptAdminInvite(c.get("db"), body);

    const [user] = await c
      .get("db")
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, accepted.email))
      .limit(1);

    if (!user) {
      throw new AdminHttpError("Failed to create admin user", 500, "INTERNAL_ERROR");
    }

    const session = await createSession(c.get("db"), user.id, secret);
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

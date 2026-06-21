import type { Hono } from "hono";
import { z } from "zod";

import { resetPassword } from "../../services/auth/password-reset.js";
import type { AdminAppBindings } from "../../types.js";

const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

/** POST /api/auth/reset-password — set a new password from a one-time token. */
export function registerResetPasswordRoute(app: Hono<AdminAppBindings>): void {
  app.post("/auth/reset-password", async (c) => {
    const body = ResetPasswordBodySchema.parse(await c.req.json());
    await resetPassword(c.get("db"), body);
    return c.body(null, 204);
  });
}

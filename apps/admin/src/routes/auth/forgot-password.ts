import type { Hono } from "hono";
import { z } from "zod";

import {
  enforceForgotPasswordRateLimit,
  type ForgotPasswordRateLimitDeps,
} from "../../middleware/forgot-password-rate-limit.js";
import {
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  requestPasswordReset,
} from "../../services/auth/password-reset.js";
import type { AdminAppBindings } from "../../types.js";

const ForgotPasswordBodySchema = z.object({
  email: z.string().trim().email(),
});

export type ForgotPasswordRouteDeps = {
  rateLimit?: ForgotPasswordRateLimitDeps;
};

/** POST /api/auth/forgot-password — enumeration-safe reset email request. */
export function registerForgotPasswordRoute(
  app: Hono<AdminAppBindings>,
  deps?: ForgotPasswordRouteDeps,
): void {
  app.post("/auth/forgot-password", async (c) => {
    const body = ForgotPasswordBodySchema.parse(await c.req.json());

    const blocked = await enforceForgotPasswordRateLimit(c, body.email, {
      env: c.get("env"),
      ...deps?.rateLimit,
    });
    if (blocked) {
      return blocked;
    }

    const result = await requestPasswordReset(
      c.get("db"),
      c.get("env"),
      { email: body.email },
      c.get("emailTransport"),
    );

    return c.json(
      {
        message: result.message ?? GENERIC_FORGOT_PASSWORD_MESSAGE,
        ...(result.resetUrl ? { reset_url: result.resetUrl } : {}),
      },
      200,
    );
  });
}

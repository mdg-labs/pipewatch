import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import { requireCloud } from "../middleware/edition-guards.js";
import { ApiErrorEnvelopeSchema, apiError } from "../middleware/error-handler.js";
import { createRateLimitMiddleware, type RateLimitDependencies } from "../middleware/rate-limit.js";
import { OpenApiTags } from "../openapi-tags.js";
import type { EmailTransport } from "../services/email/send-email.js";
import {
  confirmWaitlistSubscription,
  subscribeToWaitlist,
  unsubscribeFromWaitlist,
  type WaitlistServiceEnv,
} from "../services/waitlist/waitlist.service.js";
import type { ApiEnv } from "../types.js";

const WaitlistSubscribeBodySchema = z
  .object({
    email: z.string().trim().email().openapi({ example: "you@example.com" }),
  })
  .openapi("WaitlistSubscribeBody");

const WaitlistSubscribeResponseSchema = z
  .object({
    status: z.enum(["subscribed", "already_subscribed"]),
    email_sent: z.boolean(),
  })
  .openapi("WaitlistSubscribeResponse");

const WaitlistActionResponseSchema = z
  .object({
    status: z.enum([
      "confirmed",
      "already_confirmed",
      "unsubscribed",
      "already_unsubscribed",
    ]),
  })
  .openapi("WaitlistActionResponse");

const tokenParams = z.object({
  token: z.string().uuid(),
});

const subscribeRoute = createRoute({
  method: "post",
  path: "/api/v1/waitlist",
  tags: [OpenApiTags.WAITLIST],
  summary: "Join the waitlist",
  description:
    "Public cloud-only endpoint. Creates a subscriber row and sends a double opt-in confirmation email via SMTP.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: WaitlistSubscribeBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Subscription accepted (new or existing email)",
      content: {
        "application/json": {
          schema: WaitlistSubscribeResponseSchema,
        },
      },
    },
    404: {
      description: "Waitlist not available on this edition",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    422: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const confirmRoute = createRoute({
  method: "get",
  path: "/api/v1/waitlist/confirm/{token}",
  tags: [OpenApiTags.WAITLIST],
  summary: "Confirm waitlist subscription",
  description: "Sets confirmed_at for the subscriber matching the token.",
  request: {
    params: tokenParams,
  },
  responses: {
    200: {
      description: "Subscription confirmed or already confirmed",
      content: {
        "application/json": {
          schema: WaitlistActionResponseSchema,
        },
      },
    },
    404: {
      description: "Token not found or waitlist unavailable",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const unsubscribeRoute = createRoute({
  method: "get",
  path: "/api/v1/waitlist/unsubscribe/{token}",
  tags: [OpenApiTags.WAITLIST],
  summary: "Unsubscribe from waitlist",
  description: "Sets unsubscribed_at for the subscriber matching the token.",
  request: {
    params: tokenParams,
  },
  responses: {
    200: {
      description: "Unsubscribed or already unsubscribed",
      content: {
        "application/json": {
          schema: WaitlistActionResponseSchema,
        },
      },
    },
    404: {
      description: "Token not found or waitlist unavailable",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type WaitlistRouteDependencies = {
  db: Db;
  env: WaitlistServiceEnv;
  transport?: EmailTransport | undefined;
  rateLimit?: Partial<RateLimitDependencies>;
};

function resolveWaitlistDeps(deps?: WaitlistRouteDependencies): WaitlistRouteDependencies {
  const env = deps?.env ?? parseApiEnv();
  const resolved: WaitlistRouteDependencies = {
    db: deps?.db ?? getDb(),
    env: {
      APP_URL: env.APP_URL,
      PORT: env.PORT,
      SMTP_HOST: env.SMTP_HOST,
      SMTP_PORT: env.SMTP_PORT,
      SMTP_USER: env.SMTP_USER,
      SMTP_PASS: env.SMTP_PASS,
      SMTP_FROM: env.SMTP_FROM,
    },
  };

  if (deps?.transport) {
    resolved.transport = deps.transport;
  }

  return resolved;
}

/** Register cloud-only waitlist routes when WAITLIST_ENABLED (PRD §14). */
export function registerWaitlistRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps?: WaitlistRouteDependencies,
): void {
  app.use("/api/v1/waitlist", requireCloud);
  app.use("/api/v1/waitlist/*", requireCloud);
  app.use("/api/v1/waitlist", createRateLimitMiddleware("waitlist", deps?.rateLimit));
  app.use("/api/v1/waitlist/*", createRateLimitMiddleware("waitlist", deps?.rateLimit));

  app.openapi(subscribeRoute, async (c) => {
    const { db, env, transport } = resolveWaitlistDeps(deps);
    const { email } = c.req.valid("json");

    const result = await subscribeToWaitlist(db, env, email, transport);
    return c.json(result, 200);
  });

  app.openapi(confirmRoute, async (c) => {
    const { db } = resolveWaitlistDeps(deps);
    const { token } = c.req.valid("param");

    const result = await confirmWaitlistSubscription(db, token);
    if (!result) {
      return c.json(apiError("NOT_FOUND", "Invalid or expired token"), 404);
    }

    return c.json(result, 200);
  });

  app.openapi(unsubscribeRoute, async (c) => {
    const { db } = resolveWaitlistDeps(deps);
    const { token } = c.req.valid("param");

    const result = await unsubscribeFromWaitlist(db, token);
    if (!result) {
      return c.json(apiError("NOT_FOUND", "Invalid or expired token"), 404);
    }

    return c.json(result, 200);
  });
}

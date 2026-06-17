import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";
import Stripe from "stripe";

import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import {
  handleStripeWebhookEvent,
  SUPPORTED_STRIPE_EVENTS,
} from "../../services/stripe-webhook-handler.js";
import type { ApiEnv } from "../../types.js";

const stripeWebhookRoute = createRoute({
  method: "post",
  path: "/webhooks/stripe",
  tags: ["Webhooks"],
  summary: "Stripe billing webhook receiver",
  description:
    "Validates `Stripe-Signature`, syncs workspace plan and subscription fields for billing lifecycle events, and returns 200 immediately (PRD §24, pages B20). Cloud only.",
  responses: {
    200: {
      description: "Webhook accepted",
    },
    400: {
      description: "Invalid webhook payload",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    401: {
      description: "Invalid webhook signature",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    500: {
      description: "Unexpected server error",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type StripeWebhookDependencies = {
  env: ParsedApiEnv;
  db: Db;
  constructEvent?: Stripe["webhooks"]["constructEvent"];
  handleEvent?: typeof handleStripeWebhookEvent;
};

function resolveDatabase(deps?: Partial<StripeWebhookDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

function requireWebhookSecret(env: ParsedApiEnv): string {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return secret;
}

function resolveConstructEvent(
  override?: Stripe["webhooks"]["constructEvent"],
): Stripe["webhooks"]["constructEvent"] {
  if (override) {
    return override;
  }

  return Stripe.webhooks.constructEvent.bind(Stripe.webhooks);
}

/** Register the Stripe billing webhook receiver (PRD §24, pages B20). */
export function registerStripeWebhookRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<StripeWebhookDependencies>,
): void {
  const resolveDeps = (): StripeWebhookDependencies => {
    const env = deps?.env ?? parseApiEnv();
    return {
      env,
      db: resolveDatabase(deps),
      constructEvent: resolveConstructEvent(deps?.constructEvent),
      handleEvent: deps?.handleEvent ?? handleStripeWebhookEvent,
    };
  };

  app.openapi(stripeWebhookRoute, async (c) => {
    const resolved = resolveDeps();
    const rawBody = await c.req.text();
    const signatureHeader = c.req.header("Stripe-Signature");

    let webhookSecret: string;
    try {
      webhookSecret = requireWebhookSecret(resolved.env);
    } catch {
      return c.json(apiError("INTERNAL_ERROR", "Webhook receiver is not configured"), 500);
    }

    let event: Stripe.Event;
    try {
      event = resolved.constructEvent!(rawBody, signatureHeader ?? "", webhookSecret);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        return c.json(apiError("UNAUTHORIZED", "Invalid webhook signature"), 401);
      }

      return c.json(apiError("VALIDATION_ERROR", "Invalid webhook payload"), 400);
    }

    if (!SUPPORTED_STRIPE_EVENTS.has(event.type)) {
      return c.body(null, 200);
    }

    await resolved.handleEvent!(resolved.db, resolved.env, event);

    return c.body(null, 200);
  });
}

export { SUPPORTED_STRIPE_EVENTS };

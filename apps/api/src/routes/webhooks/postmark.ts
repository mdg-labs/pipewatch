import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";
import { subscribers } from "@pipewatch/db/schema";
import { eq } from "drizzle-orm";

import { verifyPostmarkWebhookSignature } from "../../lib/postmark-webhook-signature.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import type { ApiEnv } from "../../types.js";

const SUPPORTED_RECORD_TYPES = new Set(["Bounce", "SubscriptionChange"]);

type PostmarkWebhookEnvelope = {
  RecordType?: string;
  Email?: string;
  Recipient?: string;
  SuppressSending?: boolean;
};

const postmarkWebhookRoute = createRoute({
  method: "post",
  path: "/webhooks/postmark",
  tags: [OpenApiTags.WEBHOOKS],
  summary: "Postmark bounce and unsubscribe webhook receiver",
  description:
    "Validates `X-Postmark-Signature` (HMAC-SHA256, base64), updates `subscribers` on bounce and unsubscribe events, and returns 200 immediately (pages B21, PRD §14).",
  responses: {
    200: {
      description: "Webhook accepted",
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

export type PostmarkWebhookDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

function resolveDatabase(deps?: Partial<PostmarkWebhookDependencies>): Db {
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
  const secret = env.POSTMARK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("POSTMARK_WEBHOOK_SECRET is not configured");
  }

  return secret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseWebhookEnvelope(rawBody: string): PostmarkWebhookEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as PostmarkWebhookEnvelope;
  } catch {
    return null;
  }
}

function resolveSubscriberEmail(envelope: PostmarkWebhookEnvelope): string | null {
  if (envelope.RecordType === "Bounce") {
    return typeof envelope.Email === "string" ? envelope.Email : null;
  }

  if (envelope.RecordType === "SubscriptionChange" && envelope.SuppressSending === true) {
    return typeof envelope.Recipient === "string" ? envelope.Recipient : null;
  }

  return null;
}

/** Soft-unsubscribe a subscriber by email when Postmark reports bounce or suppression. */
export async function unsubscribeSubscriberByEmail(database: Db, email: string): Promise<void> {
  const normalized = normalizeEmail(email);

  const [subscriber] = await database
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, normalized))
    .limit(1);

  if (!subscriber || subscriber.unsubscribedAt) {
    return;
  }

  await database
    .update(subscribers)
    .set({ unsubscribedAt: new Date() })
    .where(eq(subscribers.id, subscriber.id));
}

/** Register the Postmark webhook receiver (pages B21, PRD §14). */
export function registerPostmarkWebhookRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<PostmarkWebhookDependencies>,
): void {
  const resolveDeps = (): PostmarkWebhookDependencies => {
    const env = deps?.env ?? parseApiEnv();
    return {
      env,
      db: resolveDatabase(deps),
    };
  };

  app.openapi(postmarkWebhookRoute, async (c) => {
    const resolved = resolveDeps();
    const rawBody = await c.req.text();
    const signatureHeader = c.req.header("X-Postmark-Signature");

    let webhookSecret: string;
    try {
      webhookSecret = requireWebhookSecret(resolved.env);
    } catch {
      return c.json(apiError("INTERNAL_ERROR", "Webhook receiver is not configured"), 500);
    }

    if (!verifyPostmarkWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
      return c.json(apiError("UNAUTHORIZED", "Invalid webhook signature"), 401);
    }

    const envelope = parseWebhookEnvelope(rawBody);
    const recordType = envelope?.RecordType ?? "";

    if (!SUPPORTED_RECORD_TYPES.has(recordType)) {
      return c.body(null, 200);
    }

    const email = envelope ? resolveSubscriberEmail(envelope) : null;
    if (!email) {
      return c.body(null, 200);
    }

    await unsubscribeSubscriberByEmail(resolved.db, email);

    return c.body(null, 200);
  });
}

export { SUPPORTED_RECORD_TYPES };

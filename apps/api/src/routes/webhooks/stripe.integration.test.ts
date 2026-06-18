import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { workspaces } from "@pipewatch/db/schema";
import { eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { registerStripeWebhookRoute } from "./stripe.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");

const webhookSecret = "whsec_test_stripe_webhook_secret";
const stripePricePro = "price_test_pro";
const stripePriceBusiness = "price_test_business";

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  ENCRYPTION_KEY: "c".repeat(32),
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
  GITHUB_WEBHOOK_SECRET: "d".repeat(32),
  APP_URL: "http://localhost:3000",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  STRIPE_PRICE_PRO: stripePricePro,
  STRIPE_PRICE_BUSINESS: stripePriceBusiness,
  DATABASE_URL: "",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(databaseUrl: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = createDb(databaseUrl);
      await probe.execute(sql`select 1`);
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Postgres container did not become ready in time");
}

async function seedWorkspace(
  database: Db,
  options?: {
    plan?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  },
) {
  const suffix = randomBytes(4).toString("hex");

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Billing Workspace",
      slug: `billing-${suffix}`,
      plan: options?.plan ?? "free",
      stripeCustomerId: options?.stripeCustomerId,
      stripeSubscriptionId: options?.stripeSubscriptionId,
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  return workspace;
}

function buildStripeEvent<T extends Stripe.Event.Type>(
  type: T,
  object: Stripe.Event.Data.Object,
): Stripe.Event {
  return {
    id: `evt_${randomBytes(8).toString("hex")}`,
    object: "event",
    api_version: Stripe.API_VERSION,
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

function signStripePayload(payload: string): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
}

function createTestApp(database: Db) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "cloud",
  );

  registerStripeWebhookRoute(app, { env, db: database });
  return app;
}

let postgresContainerId = "";
let database: Db;

beforeAll(async () => {
  const postgresPort = 55000 + Math.floor(Math.random() * 5000);
  const postgresPassword = randomBytes(12).toString("hex");
  const postgresRun = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "-e",
      `POSTGRES_PASSWORD=${postgresPassword}`,
      "-p",
      `${String(postgresPort)}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" },
  );

  if (postgresRun.status !== 0) {
    throw new Error(postgresRun.stderr || "Failed to start Postgres container");
  }

  postgresContainerId = postgresRun.stdout.trim();
  const databaseUrl = `postgresql://postgres:${postgresPassword}@127.0.0.1:${String(postgresPort)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;

  await waitForPostgres(databaseUrl);

  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });

  database = createDb(databaseUrl);
}, 120_000);

afterAll(async () => {
  if (postgresContainerId) {
    spawnSync("docker", ["stop", postgresContainerId], { stdio: "pipe" });
  }

  await closeDb();
});

describe("Stripe webhook receiver integration", () => {
  it("returns 401 when the webhook signature is invalid", async () => {
    const app = createTestApp(database);
    const event = buildStripeEvent("customer.subscription.created", {
      id: "sub_invalid_sig",
      object: "subscription",
      customer: "cus_invalid_sig",
      items: { object: "list", data: [], has_more: false, url: "" },
    } as unknown as Stripe.Subscription);
    const body = JSON.stringify(event);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=0,v1=deadbeef",
      },
      body,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature",
      },
    });
  });

  it("returns 401 when the signature header is missing", async () => {
    const app = createTestApp(database);
    const event = buildStripeEvent("customer.subscription.created", {
      id: "sub_missing_sig",
      object: "subscription",
      customer: "cus_missing_sig",
      items: { object: "list", data: [], has_more: false, url: "" },
    } as unknown as Stripe.Subscription);
    const body = JSON.stringify(event);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    expect(response.status).toBe(401);
  });

  it("syncs plan and subscription id on customer.subscription.created", async () => {
    const workspace = await seedWorkspace(database, {
      plan: "free",
      stripeCustomerId: "cus_created",
    });

    const subscription = {
      id: "sub_created",
      object: "subscription",
      customer: workspace.stripeCustomerId,
      metadata: { workspace_id: workspace.id },
      items: {
        object: "list",
        has_more: false,
        url: "/v1/subscription_items",
        data: [
          {
            id: "si_created",
            object: "subscription_item",
            price: { id: stripePricePro, object: "price" },
          },
        ],
      },
    } as unknown as Stripe.Subscription;

    const event = buildStripeEvent("customer.subscription.created", subscription);
    const body = JSON.stringify(event);
    const signature = signStripePayload(body);
    const app = createTestApp(database);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [updated] = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    expect(updated?.plan).toBe("pro");
    expect(updated?.stripeSubscriptionId).toBe("sub_created");
  });

  it("syncs plan changes on customer.subscription.updated", async () => {
    const workspace = await seedWorkspace(database, {
      plan: "pro",
      stripeCustomerId: "cus_updated",
      stripeSubscriptionId: "sub_updated",
    });

    const subscription = {
      id: workspace.stripeSubscriptionId,
      object: "subscription",
      customer: workspace.stripeCustomerId,
      metadata: { workspace_id: workspace.id },
      items: {
        object: "list",
        has_more: false,
        url: "/v1/subscription_items",
        data: [
          {
            id: "si_updated",
            object: "subscription_item",
            price: { id: stripePriceBusiness, object: "price" },
          },
        ],
      },
    } as unknown as Stripe.Subscription;

    const event = buildStripeEvent("customer.subscription.updated", subscription);
    const body = JSON.stringify(event);
    const signature = signStripePayload(body);
    const app = createTestApp(database);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [updated] = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    expect(updated?.plan).toBe("business");
    expect(updated?.stripeSubscriptionId).toBe("sub_updated");
  });

  it("downgrades to free on customer.subscription.deleted", async () => {
    const workspace = await seedWorkspace(database, {
      plan: "pro",
      stripeCustomerId: "cus_deleted",
      stripeSubscriptionId: "sub_deleted",
    });

    const subscription = {
      id: workspace.stripeSubscriptionId,
      object: "subscription",
      customer: workspace.stripeCustomerId,
      metadata: { workspace_id: workspace.id },
      items: { object: "list", data: [], has_more: false, url: "" },
    } as unknown as Stripe.Subscription;

    const event = buildStripeEvent("customer.subscription.deleted", subscription);
    const body = JSON.stringify(event);
    const signature = signStripePayload(body);
    const app = createTestApp(database);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [updated] = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    expect(updated?.plan).toBe("free");
    expect(updated?.stripeSubscriptionId).toBeNull();
    expect(updated?.stripeCustomerId).toBe("cus_deleted");
  });

  it("activates subscription on checkout.session.completed", async () => {
    const workspace = await seedWorkspace(database, { plan: "free" });

    const session = {
      id: "cs_completed",
      object: "checkout.session",
      mode: "subscription",
      customer: "cus_checkout",
      subscription: "sub_checkout",
      metadata: {
        workspace_id: workspace.id,
        target_plan: "pro",
      },
    } as unknown as Stripe.Checkout.Session;

    const event = buildStripeEvent("checkout.session.completed", session);
    const body = JSON.stringify(event);
    const signature = signStripePayload(body);
    const app = createTestApp(database);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [updated] = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    expect(updated?.plan).toBe("pro");
    expect(updated?.stripeCustomerId).toBe("cus_checkout");
    expect(updated?.stripeSubscriptionId).toBe("sub_checkout");
  });

  it("returns 200 without updating workspace for unsupported event types", async () => {
    const workspace = await seedWorkspace(database, { plan: "free" });
    const event = buildStripeEvent("invoice.payment_failed", {
      id: "in_failed",
      object: "invoice",
      customer: "cus_failed",
    } as unknown as Stripe.Invoice);
    const body = JSON.stringify(event);
    const signature = signStripePayload(body);
    const app = createTestApp(database);

    const response = await app.request("http://localhost/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [unchanged] = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    expect(unchanged?.plan).toBe("free");
  });
});

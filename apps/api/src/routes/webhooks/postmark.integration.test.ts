import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { subscribers } from "@pipewatch/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signPostmarkWebhookPayload } from "../../lib/postmark-webhook-signature.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { WAITLIST_SOURCE } from "../../services/waitlist/waitlist.service.js";
import { registerPostmarkWebhookRoute } from "./postmark.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");

const webhookSecret = "e".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  ENCRYPTION_KEY: "c".repeat(32),
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
  GITHUB_WEBHOOK_SECRET: "d".repeat(32),
  POSTMARK_WEBHOOK_SECRET: webhookSecret,
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "",
};

const bounceFixture = {
  RecordType: "Bounce",
  MessageStream: "outbound",
  ID: "4323372036854775807",
  Type: "HardBounce",
  TypeCode: 1,
  Name: "Hard bounce",
  MessageID: "883953f4-6105-42a2-a16a-77a8eac79483",
  ServerID: 23,
  Description: "The server was unable to deliver your message.",
  Email: "bounce@example.com",
  From: "sender@example.com",
  BouncedAt: "2019-11-05T16:33:54.9070259Z",
  Inactive: true,
  CanActivate: true,
};

const unsubscribeFixture = {
  RecordType: "SubscriptionChange",
  MessageID: "883953f4-6105-42a2-a16a-77a8eac79483",
  ServerID: 4509041,
  MessageStream: "outbound",
  ChangedAt: "2020-02-01T10:53:34.416071Z",
  Recipient: "unsubscribed@example.com",
  Origin: "Recipient",
  SuppressSending: true,
  SuppressionReason: "ManualSuppression",
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

async function seedSubscriber(database: Db, email: string) {
  const [subscriber] = await database
    .insert(subscribers)
    .values({
      email,
      source: WAITLIST_SOURCE,
      confirmedAt: new Date(),
    })
    .returning();

  if (!subscriber) {
    throw new Error("Failed to seed subscriber");
  }

  return subscriber;
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

  registerPostmarkWebhookRoute(app, { env, db: database });
  return app;
}

let containerId = "";
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

  containerId = postgresRun.stdout.trim();
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
  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }

  await closeDb();
});

describe("Postmark webhook receiver integration", () => {
  it("returns 401 when the webhook signature is invalid", async () => {
    const app = createTestApp(database);
    const body = JSON.stringify(bounceFixture);

    const response = await app.request("http://localhost/webhooks/postmark", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Signature": "invalid-signature",
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
    const body = JSON.stringify(bounceFixture);

    const response = await app.request("http://localhost/webhooks/postmark", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    expect(response.status).toBe(401);
  });

  it("unsubscribes a subscriber on bounce events", async () => {
    const email = `bounce-${randomBytes(4).toString("hex")}@example.com`;
    const subscriber = await seedSubscriber(database, email);
    const app = createTestApp(database);

    const body = JSON.stringify({
      ...bounceFixture,
      Email: email,
    });
    const signature = signPostmarkWebhookPayload(body, webhookSecret);

    const response = await app.request("http://localhost/webhooks/postmark", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [updated] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, subscriber.id))
      .limit(1);

    expect(updated?.unsubscribedAt).not.toBeNull();
  });

  it("unsubscribes a subscriber on subscription change events", async () => {
    const email = `unsub-${randomBytes(4).toString("hex")}@example.com`;
    const subscriber = await seedSubscriber(database, email);
    const app = createTestApp(database);

    const body = JSON.stringify({
      ...unsubscribeFixture,
      Recipient: email,
    });
    const signature = signPostmarkWebhookPayload(body, webhookSecret);

    const response = await app.request("http://localhost/webhooks/postmark", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);

    const [updated] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, subscriber.id))
      .limit(1);

    expect(updated?.unsubscribedAt).not.toBeNull();
  });

  it("returns 200 for unknown subscribers without error", async () => {
    const app = createTestApp(database);
    const body = JSON.stringify({
      ...bounceFixture,
      Email: `missing-${randomBytes(4).toString("hex")}@example.com`,
    });
    const signature = signPostmarkWebhookPayload(body, webhookSecret);

    const response = await app.request("http://localhost/webhooks/postmark", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);
  });

  it("returns 200 for unsupported record types", async () => {
    const app = createTestApp(database);
    const body = JSON.stringify({
      RecordType: "Delivery",
      Recipient: "delivered@example.com",
    });
    const signature = signPostmarkWebhookPayload(body, webhookSecret);

    const response = await app.request("http://localhost/webhooks/postmark", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Signature": signature,
      },
      body,
    });

    expect(response.status).toBe(200);
  });
});

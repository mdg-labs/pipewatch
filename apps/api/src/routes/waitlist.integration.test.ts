import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { subscribers } from "@pipewatch/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../middleware/error-handler.js";
import type { EmailTransport } from "../services/email/send-email.js";
import { registerWaitlistRoutes, type WaitlistRouteDependencies } from "./waitlist.js";
import type { ApiEnv } from "../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const editionMock = vi.hoisted(() => ({
  flags: {
    BILLING_ENABLED: true,
    WAITLIST_ENABLED: true,
    BOOTSTRAP_ENABLED: false,
    IS_CE: false,
    IS_CLOUD: true,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  DATABASE_URL: "",
  APP_URL: "https://cloud.pipewatch.app",
  SMTP_FROM: "noreply@pipewatch.app",
};

function createTestApp(database: Db, transport?: EmailTransport) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "cloud",
  );

  const routeDeps: WaitlistRouteDependencies = withRateLimitDisabled({ env, db: database });
  if (transport) {
    routeDeps.transport = transport;
  }

  registerWaitlistRoutes(app, routeDeps);

  return app;
}

function withRateLimitDisabled(
  routeDeps: WaitlistRouteDependencies,
): WaitlistRouteDependencies {
  return {
    ...routeDeps,
    rateLimit: { disabled: true },
  };
}

let containerId = "";
let database: Db;

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

beforeAll(async () => {
  const port = 55000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      `${String(port)}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" },
  );

  if (run.status !== 0) {
    throw new Error(run.stderr || "Failed to start Postgres container");
  }

  containerId = run.stdout.trim();
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${String(port)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;
  baseEnv.DATABASE_URL = databaseUrl;

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

describe("waitlist integration", () => {
  it("subscribes and confirms a waitlist email", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test" });
    const app = createTestApp(database, { sendMail });

    const subscribeResponse = await app.request("http://localhost/api/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "waitlist-user@example.com" }),
    });

    expect(subscribeResponse.status).toBe(200);
    await expect(subscribeResponse.json()).resolves.toEqual({
      status: "subscribed",
      email_sent: false,
    });

    const [row] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "waitlist-user@example.com"))
      .limit(1);

    expect(row).toBeDefined();
    expect(row?.confirmedAt).toBeNull();
    expect(row?.unsubscribedAt).toBeNull();
    expect(row?.source).toBe("pipewatch_waitlist");

    const confirmResponse = await app.request(
      `http://localhost/api/v1/waitlist/confirm/${row?.unsubscribeToken}`,
    );

    expect(confirmResponse.status).toBe(200);
    await expect(confirmResponse.json()).resolves.toEqual({ status: "confirmed" });

    const [confirmed] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "waitlist-user@example.com"))
      .limit(1);

    expect(confirmed?.confirmedAt).not.toBeNull();
  });

  it("sends confirmation email when SMTP is configured", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test" });
    const app = new OpenAPIHono<ApiEnv>();
    app.onError(errorHandler);

    const env = parseApiEnv(
      {
        ...baseEnv,
        DATABASE_URL: process.env.DATABASE_URL,
        SMTP_HOST: "smtp.postmarkapp.com",
        SMTP_PORT: "587",
        SMTP_USER: "token",
        SMTP_PASS: "token",
      },
      "cloud",
    );

    registerWaitlistRoutes(app, withRateLimitDisabled({ env, db: database, transport: { sendMail } }));

    const response = await app.request("http://localhost/api/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "smtp-user@example.com" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "subscribed",
      email_sent: true,
    });
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("returns already_subscribed for duplicate email without error", async () => {
    const app = createTestApp(database);

    const first = await app.request("http://localhost/api/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "duplicate@example.com" }),
    });
    expect(first.status).toBe(200);

    const second = await app.request("http://localhost/api/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "duplicate@example.com" }),
    });

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      status: "already_subscribed",
      email_sent: false,
    });

    const rows = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "duplicate@example.com"));

    expect(rows).toHaveLength(1);
  });

  it("unsubscribes via token and sets unsubscribed_at", async () => {
    const app = createTestApp(database);

    await app.request("http://localhost/api/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unsub@example.com" }),
    });

    const [row] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "unsub@example.com"))
      .limit(1);

    const response = await app.request(
      `http://localhost/api/v1/waitlist/unsubscribe/${row?.unsubscribeToken}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "unsubscribed" });

    const [updated] = await database
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "unsub@example.com"))
      .limit(1);

    expect(updated?.unsubscribedAt).not.toBeNull();
  });
});

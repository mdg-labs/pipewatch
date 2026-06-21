import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAdminEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { integrations, workspaces } from "@pipewatch/db/schema";
import { auditEvents, adminUsers, webhookDeliveries } from "@pipewatch/db-admin/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { hashPassword } from "../services/auth/password.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const testSecret = "d".repeat(32);
let testPrivateKey = "";

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ADMIN_SESSION_SECRET: testSecret,
  ADMIN_URL: "https://admin.pipewatch.app",
  ADMIN_BOOTSTRAP_EMAIL: "bootstrap@pipewatch.app",
  ADMIN_BOOTSTRAP_PASSWORD: "bootstrap-password-123",
  GITHUB_APP_ID: "12345",
  DATABASE_URL: "",
};

let containerId = "";
let database: Db;
let redeliverCalls = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(url: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const postgres = (await import("postgres")).default;
      const probe = postgres(url, { max: 1 });
      await probe`select 1`;
      await probe.end({ timeout: 5 });
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Postgres container did not become ready in time");
}

function createTestApp(db: Db) {
  const env = parseAdminEnv({ ...baseEnv, DATABASE_URL: process.env.DATABASE_URL });
  return createApp({ env, db }, null);
}

async function seedAdminUser(
  db: Db,
  params: {
    email: string;
    password: string;
    role: "viewer" | "operator" | "platform_admin";
  },
): Promise<void> {
  const passwordHash = await hashPassword(params.password);

  await db.insert(adminUsers).values({
    email: params.email,
    passwordHash,
    role: params.role,
  });
}

async function login(
  app: ReturnType<typeof createTestApp>,
  email: string,
  password: string,
): Promise<string> {
  const response = await app.request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  expect(response.status).toBe(200);

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Expected session cookie");
  }

  return setCookie.split(";")[0] ?? "";
}

function buildRedeliverFetch(): typeof fetch {
  const mockFetch = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.includes("/app/hook/deliveries/") && url.endsWith("/attempts")) {
      redeliverCalls += 1;
      return new Response(null, { status: 202 });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  return mockFetch as typeof fetch;
}

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  testPrivateKey = privateKey;
  baseEnv.GITHUB_APP_PRIVATE_KEY = testPrivateKey;

  const port = 57000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--label",
      "pipewatch-test=admin-webhook-deliveries",
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

  execSync("pnpm --filter @pipewatch/db-admin db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });

  database = createDb(databaseUrl);
}, 120_000);

afterAll(async () => {
  await closeDb();

  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }
});

describe("admin webhook delivery and health API", () => {
  it("lists deliveries with outcome and legacy unreachable filters", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `viewer-${suffix}@pipewatch.app`;
    const password = "viewer-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const [workspace] = await database
      .insert(workspaces)
      .values({ slug: `wh-${suffix}`, name: "Webhook Workspace" })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    await database.insert(integrations).values({
      workspaceId: workspace.id,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: `acct-${suffix}`,
      accountType: "Organization",
      accessToken: "secret-token",
    });

    const deliveredAt = new Date(Date.now() - 5 * 60 * 1000);
    const polledAt = new Date(Date.now() - 3 * 60 * 1000);
    const firstPolledAt = new Date(deliveredAt.getTime() + 2 * 60 * 1000);

    const [successDelivery, httpFailureDelivery, unreachableDelivery] =
      await database
      .insert(webhookDeliveries)
      .values([
        {
          githubDeliveryId: `gh-success-${suffix}`,
          githubGuid: `guid-success-${suffix}`,
          externalInstallationId: `install-${suffix}`,
          workspaceId: workspace.id,
          event: "workflow_run",
          action: "completed",
          statusCode: 200,
          status: "OK",
          duration: 0.12,
          deliveredAt,
          polledAt,
          firstPolledAt,
        },
        {
          githubDeliveryId: `gh-http-failure-${suffix}`,
          githubGuid: `guid-http-failure-${suffix}`,
          externalInstallationId: `install-${suffix}`,
          workspaceId: workspace.id,
          event: "push",
          action: null,
          statusCode: 500,
          status: "Internal Server Error",
          duration: 0.08,
          deliveredAt,
          polledAt,
          firstPolledAt,
        },
        {
          githubDeliveryId: `gh-unreachable-${suffix}`,
          githubGuid: `guid-unreachable-${suffix}`,
          externalInstallationId: `install-${suffix}`,
          workspaceId: workspace.id,
          event: "workflow_job",
          action: null,
          statusCode: 0,
          status: "Failed to deliver",
          duration: null,
          deliveredAt,
          polledAt,
          firstPolledAt,
        },
      ])
      .returning();

    if (!successDelivery || !httpFailureDelivery || !unreachableDelivery) {
      throw new Error("Failed to seed webhook deliveries");
    }

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const workspaceQuery = `workspace_id=${workspace.id}`;

    const successResponse = await app.request(
      `http://localhost/api/webhook-deliveries?outcome=success&${workspaceQuery}`,
      { headers: { cookie } },
    );

    expect(successResponse.status).toBe(200);
    const successBody = (await successResponse.json()) as {
      items: Array<{ id: string; outcome: string; statusCode: number }>;
      total: number;
    };

    expect(successBody.total).toBe(1);
    expect(successBody.items[0]).toMatchObject({
      id: successDelivery.id,
      outcome: "success",
      statusCode: 200,
    });

    const httpFailureResponse = await app.request(
      `http://localhost/api/webhook-deliveries?outcome=http_failure&${workspaceQuery}`,
      { headers: { cookie } },
    );

    expect(httpFailureResponse.status).toBe(200);
    const httpFailureBody = (await httpFailureResponse.json()) as {
      items: Array<{ id: string; outcome: string; statusCode: number }>;
      total: number;
    };

    expect(httpFailureBody.total).toBe(1);
    expect(httpFailureBody.items[0]).toMatchObject({
      id: httpFailureDelivery.id,
      outcome: "http_failure",
      statusCode: 500,
    });

    const unreachableOutcomeResponse = await app.request(
      `http://localhost/api/webhook-deliveries?outcome=unreachable&${workspaceQuery}`,
      { headers: { cookie } },
    );

    expect(unreachableOutcomeResponse.status).toBe(200);
    const unreachableOutcomeBody = (await unreachableOutcomeResponse.json()) as {
      items: Array<{ id: string; outcome: string; statusCode: number }>;
      total: number;
    };

    expect(unreachableOutcomeBody.total).toBe(1);
    expect(unreachableOutcomeBody.items[0]).toMatchObject({
      id: unreachableDelivery.id,
      outcome: "unreachable",
      statusCode: 0,
    });

    const unreachableResponse = await app.request(
      `http://localhost/api/webhook-deliveries?unreachable=true&${workspaceQuery}`,
      { headers: { cookie } },
    );

    expect(unreachableResponse.status).toBe(200);
    const unreachableBody = (await unreachableResponse.json()) as {
      items: Array<{ id: string; outcome: string; statusCode: number }>;
      total: number;
    };

    expect(unreachableBody.total).toBe(1);
    expect(unreachableBody.items[0]).toMatchObject({
      id: unreachableDelivery.id,
      outcome: "unreachable",
      statusCode: 0,
    });

    const summaryResponse = await app.request(
      "http://localhost/api/webhook-health/summary?window_minutes=60",
      { headers: { cookie } },
    );

    expect(summaryResponse.status).toBe(200);
    const summaryBody = (await summaryResponse.json()) as {
      overall: { total: number; unreachableCount: number; failureCount: number };
      installations: Array<{ externalInstallationId: string; failureRate: number }>;
    };

    expect(summaryBody.overall.total).toBeGreaterThanOrEqual(2);
    expect(summaryBody.overall.unreachableCount).toBeGreaterThanOrEqual(1);
    expect(summaryBody.installations.some((row) => row.externalInstallationId === `install-${suffix}`)).toBe(
      true,
    );

    const coverageResponse = await app.request("http://localhost/api/webhook-health/coverage", {
      headers: { cookie },
    });

    expect(coverageResponse.status).toBe(200);
    const coverageBody = (await coverageResponse.json()) as {
      lastDeliveryAt: string | null;
      lastPollAt: string | null;
      pollFreshnessSeconds: number | null;
      ingestLagSeconds: number | null;
      pollFreshnessOk: boolean;
      ingestLagOk: boolean;
    };

    expect(coverageBody.lastDeliveryAt).toBeTruthy();
    expect(coverageBody.lastPollAt).toBeTruthy();
    expect(coverageBody.pollFreshnessSeconds).toBeGreaterThanOrEqual(0);
    expect(coverageBody.ingestLagSeconds).toBe(120);
    expect(coverageBody.pollFreshnessOk).toBe(true);
    expect(coverageBody.ingestLagOk).toBe(true);
  });

  it("requires operator role and confirmation for redelivery", async () => {
    const suffix = randomBytes(4).toString("hex");
    const viewerEmail = `viewer-redeliver-${suffix}@pipewatch.app`;
    const operatorEmail = `operator-redeliver-${suffix}@pipewatch.app`;
    const password = "redeliver-password-123";

    await seedAdminUser(database, {
      email: viewerEmail,
      password,
      role: "viewer",
    });
    await seedAdminUser(database, {
      email: operatorEmail,
      password,
      role: "operator",
    });

    const [delivery] = await database
      .insert(webhookDeliveries)
      .values({
        githubDeliveryId: `gh-redeliver-${suffix}`,
        githubGuid: `guid-redeliver-${suffix}`,
        event: "push",
        statusCode: 500,
        status: "Internal Server Error",
        deliveredAt: new Date(),
        polledAt: new Date(),
        firstPolledAt: new Date(),
      })
      .returning();

    if (!delivery) {
      throw new Error("Failed to seed delivery");
    }

    const app = createTestApp(database);
    const viewerCookie = await login(app, viewerEmail, password);

    const forbiddenResponse = await app.request(
      `http://localhost/api/webhook-deliveries/${delivery.id}/redeliver`,
      {
        method: "POST",
        headers: {
          cookie: viewerCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      },
    );

    expect(forbiddenResponse.status).toBe(403);

    const operatorCookie = await login(app, operatorEmail, password);

    const missingConfirmResponse = await app.request(
      `http://localhost/api/webhook-deliveries/${delivery.id}/redeliver`,
      {
        method: "POST",
        headers: {
          cookie: operatorCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirm: false }),
      },
    );

    expect(missingConfirmResponse.status).toBe(400);

    redeliverCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = buildRedeliverFetch();

    try {
      const successResponse = await app.request(
        `http://localhost/api/webhook-deliveries/${delivery.id}/redeliver`,
        {
          method: "POST",
          headers: {
            cookie: operatorCookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ confirm: true }),
        },
      );

      expect(successResponse.status).toBe(200);
      await expect(successResponse.json()).resolves.toEqual({
        githubDeliveryId: delivery.githubDeliveryId,
      });
      expect(redeliverCalls).toBe(1);

      const auditRows = await database
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.targetId, delivery.githubDeliveryId));

      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]?.action).toBe("webhook.redeliver");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects redelivery for deliveries older than 30 days", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `operator-old-${suffix}@pipewatch.app`;
    const password = "operator-old-password-123";

    await seedAdminUser(database, { email, password, role: "operator" });

    const [delivery] = await database
      .insert(webhookDeliveries)
      .values({
        githubDeliveryId: `gh-old-${suffix}`,
        githubGuid: `guid-old-${suffix}`,
        event: "push",
        statusCode: 404,
        status: "Not Found",
        deliveredAt: new Date("2026-01-01T00:00:00.000Z"),
        polledAt: new Date("2026-01-01T00:02:00.000Z"),
        firstPolledAt: new Date("2026-01-01T00:02:00.000Z"),
      })
      .returning();

    if (!delivery) {
      throw new Error("Failed to seed old delivery");
    }

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request(
      `http://localhost/api/webhook-deliveries/${delivery.id}/redeliver`,
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REDELIVERY_EXPIRED",
        message: "Delivery is older than 30 days and cannot be redelivered",
      },
    });
  });
});

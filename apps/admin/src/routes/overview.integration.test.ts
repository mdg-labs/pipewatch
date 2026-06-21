import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAdminEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { hashPassword } from "../services/auth/password.js";
import { adminUsers, webhookDeliveries } from "@pipewatch/db-admin/schema";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const testSecret = "c".repeat(32);
const secretAccessToken = "ghs_super_secret_token_must_not_leak";

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ADMIN_SESSION_SECRET: testSecret,
  ADMIN_URL: "https://admin.pipewatch.app",
  ADMIN_BOOTSTRAP_EMAIL: "bootstrap@pipewatch.app",
  ADMIN_BOOTSTRAP_PASSWORD: "bootstrap-password-123",
  DATABASE_URL: "",
};

let containerId = "";
let database: Db;

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

function assertNoTokenLeakage(body: string): void {
  expect(body).not.toContain("access_token");
  expect(body).not.toContain("accessToken");
  expect(body).not.toContain(secretAccessToken);
  expect(body).not.toContain("stripe_customer_id");
  expect(body).not.toContain("stripeCustomerId");
  expect(body).not.toContain("stripe_subscription_id");
  expect(body).not.toContain("stripeSubscriptionId");
  expect(body).not.toContain("token_expires_at");
  expect(body).not.toContain("tokenExpiresAt");
}

beforeAll(async () => {
  const port = 56000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--label",
      "pipewatch-test=admin-overview",
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

describe("admin workspace and integration overview API", () => {
  it("returns 401 without a session", async () => {
    const app = createTestApp(database);

    const response = await app.request("http://localhost/api/workspaces");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("lists workspaces with pagination and safe fields only", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `viewer-${suffix}@pipewatch.app`;
    const password = "viewer-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Overview Workspace",
        slug: `overview-${suffix}`,
        plan: "pro",
        defaultRetentionDays: 90,
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    const githubId = BigInt(`0x${randomBytes(7).toString("hex")}`);
    const [user] = await database
      .insert(users)
      .values({
        githubId,
        githubLogin: `gh-${suffix}`,
        email: `gh-${suffix}@example.com`,
        name: "Member",
      })
      .returning();

    if (!user) {
      throw new Error("Failed to seed user");
    }

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    await database.insert(integrations).values({
      workspaceId: workspace.id,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: `org-${suffix}`,
      accountType: "Organization",
      accessToken: secretAccessToken,
    });

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request(
      "http://localhost/api/workspaces?page=1&page_size=10",
      { headers: { cookie } },
    );

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    assertNoTokenLeakage(bodyText);

    const body = JSON.parse(bodyText) as {
      items: Array<{
        id: string;
        slug: string;
        name: string;
        plan: string;
        defaultRetentionDays: number;
        integrationCount: number;
        memberCount: number;
        createdAt: string;
      }>;
      page: number;
      pageSize: number;
      total: number;
    };

    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
    expect(body.total).toBeGreaterThanOrEqual(1);

    const item = body.items.find((row) => row.id === workspace.id);
    expect(item).toMatchObject({
      slug: workspace.slug,
      name: workspace.name,
      plan: "pro",
      defaultRetentionDays: 90,
      integrationCount: 1,
      memberCount: 1,
    });
    expect(item?.createdAt).toBeTruthy();
  });

  it("returns enriched workspace detail and 404 for unknown ids", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `operator-${suffix}@pipewatch.app`;
    const password = "operator-password-123";

    await seedAdminUser(database, { email, password, role: "operator" });

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Detail Workspace",
        slug: `detail-${suffix}`,
        plan: "business",
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    const githubId = BigInt(`0x${randomBytes(7).toString("hex")}`);
    const [user] = await database
      .insert(users)
      .values({
        githubId,
        githubLogin: `detail-${suffix}`,
        email: `detail-${suffix}@example.com`,
        name: "Detail Member",
      })
      .returning();

    if (!user) {
      throw new Error("Failed to seed user");
    }

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "admin",
    });

    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-detail-${suffix}`,
        accountLogin: `org-detail-${suffix}`,
        accountType: "Organization",
        accessToken: secretAccessToken,
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const deliveredAt = new Date();
    await database.insert(webhookDeliveries).values([
      {
        githubDeliveryId: `delivery-success-${suffix}`,
        githubGuid: `guid-success-${suffix}`,
        externalInstallationId: integration.externalInstallationId,
        integrationId: integration.id,
        workspaceId: workspace.id,
        event: "workflow_run",
        statusCode: 200,
        status: "OK",
        deliveredAt,
      },
      {
        githubDeliveryId: `delivery-failure-${suffix}`,
        githubGuid: `guid-failure-${suffix}`,
        externalInstallationId: integration.externalInstallationId,
        integrationId: integration.id,
        workspaceId: workspace.id,
        event: "workflow_run",
        statusCode: 500,
        status: "Internal Server Error",
        deliveredAt,
      },
    ]);

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const detailResponse = await app.request(
      `http://localhost/api/workspaces/${workspace.id}`,
      { headers: { cookie } },
    );

    expect(detailResponse.status).toBe(200);
    const detailText = await detailResponse.text();
    assertNoTokenLeakage(detailText);
    await expect(JSON.parse(detailText)).toMatchObject({
      id: workspace.id,
      slug: workspace.slug,
      plan: "business",
      integrationCount: 1,
      memberCount: 1,
      integrations: [
        {
          id: integration.id,
          externalInstallationId: integration.externalInstallationId,
          accountLogin: `org-detail-${suffix}`,
          accountType: "Organization",
        },
      ],
      members: [
        {
          userId: user.id,
          email: `detail-${suffix}@example.com`,
          role: "admin",
        },
      ],
      recentWebhookHealth: {
        total: 2,
        successCount: 1,
        failureCount: 1,
        unreachableCount: 0,
        failureRate: 0.5,
      },
    });

    const missingResponse = await app.request(
      "http://localhost/api/workspaces/00000000-0000-4000-8000-000000000000",
      { headers: { cookie } },
    );

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Workspace not found",
      },
    });
  });

  it("lists integrations without leaking access tokens", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `integrations-${suffix}@pipewatch.app`;
    const password = "integrations-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Integration Workspace",
        slug: `integrations-${suffix}`,
        plan: "free",
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-list-${suffix}`,
        accountLogin: `acct-${suffix}`,
        accountType: "User",
        accessToken: secretAccessToken,
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request("http://localhost/api/integrations", {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    assertNoTokenLeakage(bodyText);

    const body = JSON.parse(bodyText) as {
      items: Array<{
        id: string;
        accountLogin: string;
        workspace: { slug: string; name: string };
      }>;
    };

    const item = body.items.find((row) => row.id === integration.id);
    expect(item).toMatchObject({
      accountLogin: `acct-${suffix}`,
      workspace: {
        slug: workspace.slug,
        name: workspace.name,
      },
    });
  });

  it("returns integration detail with workspace metadata and 404 for unknown ids", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `integration-detail-${suffix}@pipewatch.app`;
    const password = "integration-detail-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Integration Detail Workspace",
        slug: `integration-detail-${suffix}`,
        plan: "pro",
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-detail-api-${suffix}`,
        accountLogin: `acct-detail-${suffix}`,
        accountType: "User",
        accessToken: secretAccessToken,
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const deliveredAt = new Date();
    await database.insert(webhookDeliveries).values({
      githubDeliveryId: `delivery-unreachable-${suffix}`,
      githubGuid: `guid-unreachable-${suffix}`,
      externalInstallationId: integration.externalInstallationId,
      integrationId: integration.id,
      workspaceId: workspace.id,
      event: "push",
      statusCode: 0,
      status: "Failed to connect",
      deliveredAt,
    });

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const detailResponse = await app.request(
      `http://localhost/api/integrations/${integration.id}`,
      { headers: { cookie } },
    );

    expect(detailResponse.status).toBe(200);
    const detailText = await detailResponse.text();
    assertNoTokenLeakage(detailText);
    await expect(JSON.parse(detailText)).toMatchObject({
      id: integration.id,
      externalInstallationId: integration.externalInstallationId,
      accountLogin: `acct-detail-${suffix}`,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      },
      recentWebhookHealth: {
        total: 1,
        successCount: 0,
        failureCount: 1,
        unreachableCount: 1,
        failureRate: 1,
      },
    });

    const missingResponse = await app.request(
      "http://localhost/api/integrations/00000000-0000-4000-8000-000000000000",
      { headers: { cookie } },
    );

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Integration not found",
      },
    });
  });

  it("returns 403 when invite management requires platform_admin", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `forbidden-${suffix}@pipewatch.app`;
    const password = "forbidden-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request("http://localhost/api/admin/invites", {
      headers: { cookie },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
  });
});

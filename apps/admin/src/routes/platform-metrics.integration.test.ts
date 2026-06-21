import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAdminEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineRuns,
  repositories,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { adminUsers } from "@pipewatch/db-admin/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { hashPassword } from "../services/auth/password.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const testSecret = "d".repeat(32);

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

function assertNoSensitiveLeakage(body: string): void {
  expect(body).not.toContain("access_token");
  expect(body).not.toContain("accessToken");
  expect(body).not.toContain("stripe_customer_id");
  expect(body).not.toContain("stripeCustomerId");
  expect(body).not.toContain("stripe_subscription_id");
  expect(body).not.toContain("stripeSubscriptionId");
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
      "pipewatch-test=admin-platform-metrics",
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

describe("admin platform metrics API", () => {
  it("returns 401 without a session", async () => {
    const app = createTestApp(database);

    const response = await app.request("http://localhost/api/platform-metrics/summary");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("returns aggregate summary with seeded counts", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `metrics-viewer-${suffix}@pipewatch.app`;
    const password = "metrics-viewer-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Metrics Workspace",
        slug: `metrics-${suffix}`,
        plan: "pro",
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
        githubLogin: `metrics-${suffix}`,
        email: `metrics-${suffix}@example.com`,
        name: "Metrics User",
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

    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-metrics-${suffix}`,
        accountLogin: `org-metrics-${suffix}`,
        accountType: "Organization",
        accessToken: "secret-token-must-not-leak",
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const [repository] = await database
      .insert(repositories)
      .values({
        workspaceId: workspace.id,
        integrationId: integration.id,
        externalRepoId: `repo-${suffix}`,
        fullName: `org-metrics-${suffix}/repo`,
        private: false,
      })
      .returning();

    if (!repository) {
      throw new Error("Failed to seed repository");
    }

    const recentStartedAt = new Date();
    const oldStartedAt = new Date();
    oldStartedAt.setDate(oldStartedAt.getDate() - 45);

    await database.insert(pipelineRuns).values([
      {
        workspaceId: workspace.id,
        repoId: repository.id,
        externalRunId: `run-recent-${suffix}`,
        pipelineName: "CI",
        pipelineDefinitionRef: "ci.yml",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "a".repeat(40),
        triggerType: "push",
        sourceUrl: "https://github.com/example/repo/actions/runs/1",
        startedAt: recentStartedAt,
        createdAt: recentStartedAt,
      },
      {
        workspaceId: workspace.id,
        repoId: repository.id,
        externalRunId: `run-old-${suffix}`,
        pipelineName: "CI",
        pipelineDefinitionRef: "ci.yml",
        status: "completed",
        conclusion: "success",
        branch: "main",
        commitSha: "b".repeat(40),
        triggerType: "push",
        sourceUrl: "https://github.com/example/repo/actions/runs/2",
        startedAt: oldStartedAt,
        createdAt: oldStartedAt,
      },
    ]);

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request("http://localhost/api/platform-metrics/summary", {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    assertNoSensitiveLeakage(bodyText);

    const body = JSON.parse(bodyText) as {
      totalWorkspaces: number;
      totalIntegrations: number;
      totalProductUsers: number;
      totalPipelineRuns: number;
      pipelineRunsLast30Days: number;
      workspacesByPlan: { free: number; pro: number; business: number };
    };

    expect(body.totalWorkspaces).toBeGreaterThanOrEqual(1);
    expect(body.totalIntegrations).toBeGreaterThanOrEqual(1);
    expect(body.totalProductUsers).toBeGreaterThanOrEqual(1);
    expect(body.totalPipelineRuns).toBeGreaterThanOrEqual(2);
    expect(body.pipelineRunsLast30Days).toBeGreaterThanOrEqual(1);
    expect(body.workspacesByPlan.pro).toBeGreaterThanOrEqual(1);
  });

  it("returns paginated per-workspace rollup with pipeline run counts", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `metrics-workspaces-${suffix}@pipewatch.app`;
    const password = "metrics-workspaces-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Rollup Workspace",
        slug: `rollup-${suffix}`,
        plan: "free",
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
        githubLogin: `rollup-${suffix}`,
        email: `rollup-${suffix}@example.com`,
        name: "Rollup User",
      })
      .returning();

    if (!user) {
      throw new Error("Failed to seed user");
    }

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "member",
    });

    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-rollup-${suffix}`,
        accountLogin: `org-rollup-${suffix}`,
        accountType: "Organization",
        accessToken: "secret-token-must-not-leak",
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const [repository] = await database
      .insert(repositories)
      .values({
        workspaceId: workspace.id,
        integrationId: integration.id,
        externalRepoId: `repo-rollup-${suffix}`,
        fullName: `org-rollup-${suffix}/repo`,
        private: false,
      })
      .returning();

    if (!repository) {
      throw new Error("Failed to seed repository");
    }

    const startedAt = new Date();
    await database.insert(pipelineRuns).values({
      workspaceId: workspace.id,
      repoId: repository.id,
      externalRunId: `run-rollup-${suffix}`,
      pipelineName: "CI",
      pipelineDefinitionRef: "ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "c".repeat(40),
      triggerType: "push",
      sourceUrl: "https://github.com/example/repo/actions/runs/3",
      startedAt,
      createdAt: startedAt,
    });

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request(
      "http://localhost/api/platform-metrics/workspaces?page=1&page_size=10",
      { headers: { cookie } },
    );

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    assertNoSensitiveLeakage(bodyText);

    const body = JSON.parse(bodyText) as {
      items: Array<{
        id: string;
        slug: string;
        name: string;
        memberCount: number;
        integrationCount: number;
        pipelineRunCount: number;
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
      memberCount: 1,
      integrationCount: 1,
      pipelineRunCount: 1,
    });
  });
});

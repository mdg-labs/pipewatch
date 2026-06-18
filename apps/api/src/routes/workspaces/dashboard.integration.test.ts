import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineRuns,
  repositories,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import type { WorkspaceDashboard } from "../../services/dashboard-aggregates.js";
import { registerWorkspaceRoutes } from "./index.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);
const encryptionKey = "c".repeat(32);

let testPrivateKey = "";

const editionMock = vi.hoisted(() => ({
  flags: {
    BILLING_ENABLED: true,
    PLAN_LIMITS_ENABLED: true,
    WAITLIST_ENABLED: true,
    NEWSLETTER_ENABLED: true,
    MULTI_WORKSPACE_ENABLED: true,
    BOOTSTRAP_ENABLED: false,
    UMAMI_ENABLED: true,
    STRIPE_ENABLED: true,
    API_KEYS_ENABLED: true,
    SSO_ENABLED: false,
    RETENTION_CEILING: true,
    IS_CE: false,
    IS_CLOUD: true,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: "b".repeat(32),
  ENCRYPTION_KEY: encryptionKey,
  GITHUB_APP_ID: "123456",
  get GITHUB_APP_PRIVATE_KEY() {
    return testPrivateKey;
  },
  GITHUB_WEBHOOK_SECRET: "d".repeat(32),
  DATABASE_URL: "",
};

type SeedUser = {
  id: string;
};

async function seedUser(database: Db, loginPrefix: string): Promise<SeedUser> {
  const suffix = randomBytes(4).toString("hex");
  const githubId = BigInt(`0x${randomBytes(7).toString("hex")}`);

  const [user] = await database
    .insert(users)
    .values({
      githubId,
      githubLogin: `${loginPrefix}-${suffix}`,
      email: `${loginPrefix}-${suffix}@example.com`,
      name: "Dashboard User",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return { id: user.id };
}

type SeedWorkspace = {
  id: string;
};

async function seedWorkspace(database: Db, slugPrefix: string): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Dashboard Workspace",
      slug: `${slugPrefix}-${suffix}`,
      plan: "pro",
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  return { id: workspace.id };
}

async function addMember(
  database: Db,
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member",
): Promise<void> {
  await database.insert(workspaceMembers).values({
    workspaceId,
    userId,
    role,
    acceptedAt: new Date(),
  });
}

async function bearerToken(
  userId: string,
  workspaceId: string,
  role: "owner" | "admin" | "member",
): Promise<string> {
  return signAccessToken({ userId, workspaceId, role }, testSecret);
}

type SeedIntegration = {
  id: string;
};

async function seedIntegration(database: Db, workspaceId: string): Promise<SeedIntegration> {
  const suffix = randomBytes(4).toString("hex");
  const [integration] = await database
    .insert(integrations)
    .values({
      workspaceId,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: `org-${suffix}`,
      accountType: "Organization",
      accessToken: "encrypted-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: integrations.id });

  if (!integration) {
    throw new Error("Failed to seed integration");
  }

  return { id: integration.id };
}

type SeedRepository = {
  id: string;
  fullName: string;
};

async function seedRepository(
  database: Db,
  workspaceId: string,
  integrationId: string,
  fullName: string,
): Promise<SeedRepository> {
  const suffix = randomBytes(4).toString("hex");
  const [repository] = await database
    .insert(repositories)
    .values({
      workspaceId,
      integrationId,
      externalRepoId: `repo-${suffix}`,
      fullName,
      private: false,
      enabled: true,
    })
    .returning({ id: repositories.id, fullName: repositories.fullName });

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return { id: repository.id, fullName: repository.fullName };
}

async function seedRun(
  database: Db,
  workspaceId: string,
  repoId: string,
  overrides: Partial<typeof pipelineRuns.$inferInsert> = {},
): Promise<void> {
  const suffix = randomBytes(4).toString("hex");
  await database.insert(pipelineRuns).values({
    workspaceId,
    repoId,
    externalRunId: `external-${suffix}`,
    pipelineName: "CI",
    pipelineDefinitionRef: ".github/workflows/ci.yml",
    status: "completed",
    conclusion: "success",
    branch: "main",
    commitSha: "abc123",
    commitMessage: "feat: dashboard",
    actorLogin: "dev-user",
    triggerType: "push",
    sourceUrl: `https://github.com/org/repo/actions/runs/${suffix}`,
    startedAt: new Date("2026-06-10T12:00:00.000Z"),
    completedAt: new Date("2026-06-10T12:05:00.000Z"),
    durationMs: 300_000,
    ...overrides,
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

  registerWorkspaceRoutes(app, {
    env,
    db: database,
  });

  return app;
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
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  testPrivateKey = privateKey;

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
    stdio: "inherit",
  });

  database = createDb(databaseUrl);
});

afterAll(async () => {
  await closeDb();

  if (containerId) {
    spawnSync("docker", ["stop", containerId], { encoding: "utf8" });
  }
});

describe("GET /api/v1/workspaces/:workspaceId/dashboard", () => {
  it("returns health summary and per-repo card data", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "dashboard-user");
    const workspace = await seedWorkspace(database, "dashboard-ws");
    await addMember(database, workspace.id, user.id, "member");
    const integration = await seedIntegration(database, workspace.id);

    const healthyRepo = await seedRepository(database, workspace.id, integration.id, "acme/healthy");
    const failingRepo = await seedRepository(database, workspace.id, integration.id, "acme/failing");
    const runningRepo = await seedRepository(database, workspace.id, integration.id, "acme/running");

    await seedRun(database, workspace.id, healthyRepo.id, {
      externalRunId: "healthy-latest",
      startedAt: new Date("2026-06-16T10:00:00.000Z"),
      completedAt: new Date("2026-06-16T10:05:00.000Z"),
      conclusion: "success",
    });
    await seedRun(database, workspace.id, healthyRepo.id, {
      externalRunId: "healthy-old-failure",
      startedAt: new Date("2026-06-15T10:00:00.000Z"),
      completedAt: new Date("2026-06-15T10:05:00.000Z"),
      conclusion: "failure",
    });

    await seedRun(database, workspace.id, failingRepo.id, {
      externalRunId: "failing-latest",
      startedAt: new Date("2026-06-16T11:00:00.000Z"),
      completedAt: new Date("2026-06-16T11:05:00.000Z"),
      conclusion: "failure",
    });

    await seedRun(database, workspace.id, runningRepo.id, {
      externalRunId: "running-active",
      status: "in_progress",
      conclusion: null,
      startedAt: new Date("2026-06-16T12:00:00.000Z"),
      completedAt: null,
      durationMs: null,
    });
    await seedRun(database, workspace.id, runningRepo.id, {
      externalRunId: "running-completed",
      startedAt: new Date("2026-06-15T12:00:00.000Z"),
      completedAt: new Date("2026-06-15T12:05:00.000Z"),
      conclusion: "success",
    });

    const token = await bearerToken(user.id, workspace.id, "member");
    const response = await app.request(`/api/v1/workspaces/${workspace.id}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceDashboard;

    expect(body.health).toEqual({
      healthy: 1,
      running: 1,
      failing: 1,
      total: 3,
    });

    expect(body.repos).toHaveLength(3);

    const healthyCard = body.repos.find((repo) => repo.id === healthyRepo.id);
    expect(healthyCard).toMatchObject({
      full_name: healthyRepo.fullName,
      integration_id: integration.id,
      is_running: false,
      health: "healthy",
    });
    expect(healthyCard?.last_run?.conclusion).toBe("success");
    expect(healthyCard?.sparkline).toHaveLength(7);

    const failingCard = body.repos.find((repo) => repo.id === failingRepo.id);
    expect(failingCard).toMatchObject({
      health: "failing",
      is_running: false,
    });
    expect(failingCard?.last_run?.conclusion).toBe("failure");

    const runningCard = body.repos.find((repo) => repo.id === runningRepo.id);
    expect(runningCard).toMatchObject({
      health: "running",
      is_running: true,
    });
    expect(runningCard?.last_run?.status).toBe("in_progress");
  });

  it("returns 401 without authentication", async () => {
    const app = createTestApp(database);
    const workspace = await seedWorkspace(database, "dashboard-unauth");

    const response = await app.request(`/api/v1/workspaces/${workspace.id}/dashboard`);

    expect(response.status).toBe(401);
  });

  it("returns empty dashboard when no enabled repositories exist", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "dashboard-empty");
    const workspace = await seedWorkspace(database, "dashboard-empty-ws");
    await addMember(database, workspace.id, user.id, "member");

    const token = await bearerToken(user.id, workspace.id, "member");
    const response = await app.request(`/api/v1/workspaces/${workspace.id}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceDashboard;

    expect(body.health).toEqual({
      healthy: 0,
      running: 0,
      failing: 0,
      total: 0,
    });
    expect(body.repos).toEqual([]);
  });
});

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
import type { WorkspaceInsights } from "@pipewatch/types";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { signAccessToken } from "../../services/auth/jwt.js";
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
      name: "Insights User",
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
      name: "Insights Workspace",
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
    commitMessage: "feat: insights",
    actorLogin: "dev-user",
    triggerType: "push",
    sourceUrl: `https://github.com/org/repo/actions/runs/${suffix}`,
    startedAt: new Date(),
    completedAt: new Date(),
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

describe("GET /api/v1/workspaces/:workspaceId/insights", () => {
  it("returns summary cards, time series, and workflow tables", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "insights-user");
    const workspace = await seedWorkspace(database, "insights-ws");
    await addMember(database, workspace.id, user.id, "member");
    const integration = await seedIntegration(database, workspace.id);

    const activeRepo = await seedRepository(database, workspace.id, integration.id, "acme/active");
    const slowRepo = await seedRepository(database, workspace.id, integration.id, "acme/slow");

    const recentDay = new Date();
    recentDay.setUTCDate(recentDay.getUTCDate() - 1);

    await seedRun(database, workspace.id, activeRepo.id, {
      externalRunId: "active-1",
      pipelineName: "CI",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 120_000,
      conclusion: "success",
    });
    await seedRun(database, workspace.id, activeRepo.id, {
      externalRunId: "active-2",
      pipelineName: "CI",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 180_000,
      conclusion: "success",
    });
    await seedRun(database, workspace.id, activeRepo.id, {
      externalRunId: "active-fail",
      pipelineName: "Deploy",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 240_000,
      conclusion: "failure",
    });

    await seedRun(database, workspace.id, slowRepo.id, {
      externalRunId: "slow-1",
      pipelineName: "Nightly",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 900_000,
      conclusion: "success",
    });
    await seedRun(database, workspace.id, slowRepo.id, {
      externalRunId: "slow-2",
      pipelineName: "Nightly",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 1_200_000,
      conclusion: "failure",
    });

    const token = await bearerToken(user.id, workspace.id, "member");
    const response = await app.request(
      `/api/v1/workspaces/${workspace.id}/insights?range=7d`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceInsights;

    expect(body.range).toBe("7d");
    expect(body.summary.total_runs).toBe(5);
    expect(body.summary.success_rate).toBe(60);
    expect(body.summary.avg_duration_ms).toBe(528_000);
    expect(body.summary.most_active_repo).toMatchObject({
      repo_id: activeRepo.id,
      full_name: activeRepo.fullName,
      run_count: 3,
    });

    expect(body.time_series.duration).toHaveLength(7);
    expect(body.time_series.failure_rate).toHaveLength(7);

    const dayWithData = body.time_series.duration.find((day) => day.points.length > 0);
    expect(dayWithData?.points.length).toBeGreaterThan(0);

    expect(body.slowest_workflows.length).toBeGreaterThan(0);
    expect(body.slowest_workflows[0]).toMatchObject({
      workflow: "Nightly",
      repo_id: slowRepo.id,
      repo_full_name: slowRepo.fullName,
    });
    expect(body.slowest_workflows[0]?.avg_duration_ms).toBe(1_050_000);
    expect(body.slowest_workflows[0]?.p50_duration_ms).toBeGreaterThan(0);
    expect(body.slowest_workflows[0]?.p95_duration_ms).toBeGreaterThan(0);

    expect(body.most_failing_workflows.length).toBeGreaterThan(0);
    const deployFailure = body.most_failing_workflows.find(
      (row) => row.workflow === "Deploy",
    );
    expect(deployFailure).toMatchObject({
      failure_rate: 100,
      failure_count: 1,
      run_count: 1,
    });
  });

  it("filters by repoId and workflow query params", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "insights-filter");
    const workspace = await seedWorkspace(database, "insights-filter-ws");
    await addMember(database, workspace.id, user.id, "member");
    const integration = await seedIntegration(database, workspace.id);

    const repoA = await seedRepository(database, workspace.id, integration.id, "acme/a");
    const repoB = await seedRepository(database, workspace.id, integration.id, "acme/b");
    const recentDay = new Date();
    recentDay.setUTCDate(recentDay.getUTCDate() - 1);

    await seedRun(database, workspace.id, repoA.id, {
      externalRunId: "filter-a-ci",
      pipelineName: "CI",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 100_000,
      conclusion: "success",
    });
    await seedRun(database, workspace.id, repoB.id, {
      externalRunId: "filter-b-deploy",
      pipelineName: "Deploy",
      startedAt: recentDay,
      completedAt: recentDay,
      durationMs: 200_000,
      conclusion: "failure",
    });

    const token = await bearerToken(user.id, workspace.id, "member");
    const response = await app.request(
      `/api/v1/workspaces/${workspace.id}/insights?range=7d&repoId=${repoA.id}&workflow=CI`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceInsights;

    expect(body.summary.total_runs).toBe(1);
    expect(body.summary.most_active_repo).toMatchObject({
      repo_id: repoA.id,
      run_count: 1,
    });
    expect(body.slowest_workflows).toHaveLength(1);
    expect(body.slowest_workflows[0]?.workflow).toBe("CI");
    expect(body.most_failing_workflows).toEqual([]);
  });

  it("returns a valid empty structure when no runs exist", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "insights-empty");
    const workspace = await seedWorkspace(database, "insights-empty-ws");
    await addMember(database, workspace.id, user.id, "member");

    const token = await bearerToken(user.id, workspace.id, "member");
    const response = await app.request(
      `/api/v1/workspaces/${workspace.id}/insights?range=30d`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceInsights;

    expect(body).toEqual({
      range: "30d",
      summary: {
        total_runs: 0,
        success_rate: 0,
        avg_duration_ms: null,
        most_active_repo: null,
        trends: {
          total_runs_percent: null,
          success_rate_points: null,
          avg_duration_percent: null,
        },
      },
      time_series: {
        duration: [],
        failure_rate: [],
      },
      slowest_workflows: [],
      most_failing_workflows: [],
    });
  });

  it("returns 401 without authentication", async () => {
    const app = createTestApp(database);
    const workspace = await seedWorkspace(database, "insights-unauth");

    const response = await app.request(`/api/v1/workspaces/${workspace.id}/insights`);

    expect(response.status).toBe(401);
  });
});

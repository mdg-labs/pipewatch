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
import type { PipelineRun } from "@pipewatch/types";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { signAccessToken } from "../../../services/auth/jwt.js";
import { registerWorkspaceRoutes } from "../index.js";
import type { ApiEnv } from "../../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

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

type RunsListResponse = {
  data: PipelineRun[];
  cursor: string | null;
  has_more: boolean;
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
      name: "Workspace User",
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
      name: "Runs Workspace",
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
};

async function seedRepository(
  database: Db,
  workspaceId: string,
  integrationId: string,
): Promise<SeedRepository> {
  const suffix = randomBytes(4).toString("hex");
  const [repository] = await database
    .insert(repositories)
    .values({
      workspaceId,
      integrationId,
      externalRepoId: `repo-${suffix}`,
      fullName: `org/repo-${suffix}`,
      private: false,
      enabled: true,
    })
    .returning({ id: repositories.id });

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return { id: repository.id };
}

type SeedRun = {
  id: string;
};

async function seedRun(
  database: Db,
  workspaceId: string,
  repoId: string,
  overrides: Partial<typeof pipelineRuns.$inferInsert> = {},
): Promise<SeedRun> {
  const suffix = randomBytes(4).toString("hex");
  const [run] = await database
    .insert(pipelineRuns)
    .values({
      workspaceId,
      repoId,
      externalRunId: `external-${suffix}`,
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123",
      commitMessage: "feat: add runs API",
      actorLogin: "dev-user",
      triggerType: "push",
      sourceUrl: `https://github.com/org/repo/actions/runs/${suffix}`,
      startedAt: new Date("2026-06-10T12:00:00.000Z"),
      completedAt: new Date("2026-06-10T12:05:00.000Z"),
      durationMs: 300_000,
      ...overrides,
    })
    .returning({ id: pipelineRuns.id });

  if (!run) {
    throw new Error("Failed to seed pipeline run");
  }

  return { id: run.id };
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

describe("workspace pipeline runs routes", () => {
  it("lists runs sorted by started_at desc with default page size", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "runs-list");
    const workspace = await seedWorkspace(database, "runs-list");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);

    const older = await seedRun(database, workspace.id, repository.id, {
      externalRunId: "older-run",
      startedAt: new Date("2026-06-01T12:00:00.000Z"),
      branch: "main",
    });
    const newer = await seedRun(database, workspace.id, repository.id, {
      externalRunId: "newer-run",
      startedAt: new Date("2026-06-15T12:00:00.000Z"),
      branch: "develop",
      pipelineName: "Deploy",
      status: "in_progress",
      conclusion: null,
      triggerType: "workflow_dispatch",
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as RunsListResponse;
    expect(body.data).toHaveLength(2);
    expect(body.has_more).toBe(false);
    expect(body.cursor).toBeNull();
    expect(body.data[0]?.id).toBe(newer.id);
    expect(body.data[1]?.id).toBe(older.id);
    expect(body.data[0]).toMatchObject({
      source_url: expect.stringContaining("github.com"),
      commit_sha: expect.any(String),
      commit_message: expect.any(String),
      actor_login: "dev-user",
      trigger_type: "workflow_dispatch",
    });
  });

  it("paginates with page_size and cursor", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "runs-page");
    const workspace = await seedWorkspace(database, "runs-page");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);

    for (let index = 0; index < 3; index += 1) {
      await seedRun(database, workspace.id, repository.id, {
        externalRunId: `page-run-${String(index)}`,
        startedAt: new Date(`2026-06-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`),
      });
    }

    const firstResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs?page_size=2`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(firstResponse.status).toBe(200);
    const firstPage = (await firstResponse.json()) as RunsListResponse;
    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.has_more).toBe(true);
    expect(firstPage.cursor).toBeTruthy();

    const secondResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs?page_size=2&cursor=${encodeURIComponent(firstPage.cursor ?? "")}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(secondResponse.status).toBe(200);
    const secondPage = (await secondResponse.json()) as RunsListResponse;
    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.has_more).toBe(false);
    expect(secondPage.cursor).toBeNull();
  });

  it("filters by branch, workflow, status, trigger, and date range", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "runs-filter");
    const workspace = await seedWorkspace(database, "runs-filter");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);

    const match = await seedRun(database, workspace.id, repository.id, {
      externalRunId: "filter-match",
      branch: "feature/x",
      pipelineName: "Lint",
      status: "completed",
      triggerType: "pull_request",
      startedAt: new Date("2026-06-12T10:00:00.000Z"),
    });

    await seedRun(database, workspace.id, repository.id, {
      externalRunId: "filter-other",
      branch: "main",
      pipelineName: "CI",
      status: "in_progress",
      triggerType: "push",
      startedAt: new Date("2026-06-12T08:00:00.000Z"),
    });

    const url =
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs` +
      "?branch=feature%2Fx&workflow=Lint&status=completed&trigger=pull_request" +
      "&started_from=2026-06-12T09:00:00.000Z&started_to=2026-06-12T11:00:00.000Z";

    const response = await app.request(url, {
      headers: {
        Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as RunsListResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe(match.id);
  });

  it("returns full B6 header fields for a single run", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "runs-get");
    const workspace = await seedWorkspace(database, "runs-get");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);
    const run = await seedRun(database, workspace.id, repository.id, {
      externalRunId: "detail-run",
      pipelineName: "Release",
      commitMessage: "chore: release v1",
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PipelineRun;
    expect(body).toMatchObject({
      id: run.id,
      workspace_id: workspace.id,
      repo_id: repository.id,
      pipeline_name: "Release",
      commit_sha: "abc123",
      commit_message: "chore: release v1",
      actor_login: "dev-user",
      trigger_type: "push",
      source_url: expect.stringContaining("github.com"),
      started_at: expect.any(String),
      completed_at: expect.any(String),
      duration_ms: 300_000,
    });
  });

  it("returns 404 when the repository is not in the workspace", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "runs-missing-repo");
    const workspace = await seedWorkspace(database, "runs-missing-repo");
    const otherWorkspace = await seedWorkspace(database, "runs-other");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, otherWorkspace.id);
    const repository = await seedRepository(database, otherWorkspace.id, integration.id);

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(404);
  });

  it("deletes a run for admins and blocks members", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "runs-delete-owner");
    const member = await seedUser(database, "runs-delete-member");
    const workspace = await seedWorkspace(database, "runs-delete");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);
    const run = await seedRun(database, workspace.id, repository.id, {
      externalRunId: "delete-run",
    });

    const memberResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );
    expect(memberResponse.status).toBe(403);

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(204);

    const remaining = await database
      .select({ id: pipelineRuns.id })
      .from(pipelineRuns)
      .where(and(eq(pipelineRuns.repoId, repository.id), eq(pipelineRuns.id, run.id)));
    expect(remaining).toHaveLength(0);
  });
});

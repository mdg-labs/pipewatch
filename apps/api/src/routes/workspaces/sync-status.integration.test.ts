import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  repositories,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import type { BackfillJobSnapshot, WorkspaceSyncStatus } from "../../services/sync-status.js";
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
      name: "Sync Status User",
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
      name: "Sync Status Workspace",
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
  overrides: Partial<typeof repositories.$inferInsert> = {},
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
      enabled: false,
      ...overrides,
    })
    .returning({ id: repositories.id });

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return { id: repository.id };
}

function createTestApp(
  database: Db,
  options: {
    listBackfillJobs?: (
      redisUrl: string,
      workspaceId: string,
    ) => Promise<BackfillJobSnapshot>;
  } = {},
) {
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
    ...(options.listBackfillJobs ? { listBackfillJobs: options.listBackfillJobs } : {}),
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
    throw new Error(`Failed to start Postgres container: ${run.stderr || run.stdout}`);
  }

  containerId = run.stdout.trim();
  const databaseUrl = `postgresql://postgres:${password}@localhost:${String(port)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;

  await waitForPostgres(databaseUrl);
  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  database = createDb(databaseUrl);
});

afterAll(async () => {
  await closeDb();

  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }
});

describe("GET /api/v1/workspaces/:workspaceId/sync-status", () => {
  it("returns per-integration and per-repo sync status from the database", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "sync-status-owner");
    const workspace = await seedWorkspace(database, "sync-status");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const syncedAt = new Date("2026-06-17T10:00:00.000Z");
    const syncedRepo = await seedRepository(database, workspace.id, integration.id, {
      enabled: true,
      lastSyncedAt: syncedAt,
    });
    await seedRepository(database, workspace.id, integration.id, {
      enabled: false,
      lastSyncedAt: null,
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/sync-status`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceSyncStatus;
    expect(body.integrations).toHaveLength(1);

    const [integrationStatus] = body.integrations;
    expect(integrationStatus?.id).toBe(integration.id);
    expect(integrationStatus?.enabled).toBe(true);
    expect(integrationStatus?.last_synced_at).toBe(syncedAt.toISOString());
    expect(integrationStatus?.backfill_in_progress).toBe(false);
    expect(integrationStatus?.repos).toHaveLength(2);

    const synced = integrationStatus?.repos.find((repo) => repo.id === syncedRepo.id);
    expect(synced).toMatchObject({
      enabled: true,
      last_synced_at: syncedAt.toISOString(),
      backfill_in_progress: false,
    });
  });

  it("marks backfill_in_progress from mocked queue state", async () => {
    const owner = await seedUser(database, "sync-queue-owner");
    const workspace = await seedWorkspace(database, "sync-queue");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const pendingRepo = await seedRepository(database, workspace.id, integration.id, {
      enabled: true,
      lastSyncedAt: null,
    });
    await seedRepository(database, workspace.id, integration.id, {
      enabled: true,
      lastSyncedAt: new Date("2026-06-17T09:00:00.000Z"),
    });

    const listBackfillJobs = vi.fn(
      async (): Promise<BackfillJobSnapshot> => ({
        integrationJobs: [
          {
            integrationId: integration.id,
            workspaceId: workspace.id,
            enqueuedAt: Date.now(),
            pending: true,
          },
        ],
        repoJobs: [
          {
            repoId: pendingRepo.id,
            workspaceId: workspace.id,
            integrationId: integration.id,
            enqueuedAt: Date.now(),
            pending: true,
          },
        ],
      }),
    );

    const app = createTestApp(database, { listBackfillJobs });
    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/sync-status`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceSyncStatus;
    const [integrationStatus] = body.integrations;
    expect(integrationStatus?.backfill_in_progress).toBe(true);

    const pending = integrationStatus?.repos.find((repo) => repo.id === pendingRepo.id);
    expect(pending?.backfill_in_progress).toBe(true);
    expect(listBackfillJobs).toHaveBeenCalledOnce();
  });

  it("filters by integrationId query param", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "sync-filter-owner");
    const workspace = await seedWorkspace(database, "sync-filter");
    await addMember(database, workspace.id, owner.id, "owner");
    const firstIntegration = await seedIntegration(database, workspace.id);
    const secondIntegration = await seedIntegration(database, workspace.id);
    await seedRepository(database, workspace.id, firstIntegration.id, { enabled: true });
    await seedRepository(database, workspace.id, secondIntegration.id, { enabled: true });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/sync-status?integrationId=${firstIntegration.id}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceSyncStatus;
    expect(body.integrations).toHaveLength(1);
    expect(body.integrations[0]?.id).toBe(firstIntegration.id);
    expect(body.integrations[0]?.repos).toHaveLength(1);
  });

  it("allows workspace members to read sync status", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "sync-member-owner");
    const member = await seedUser(database, "sync-member");
    const workspace = await seedWorkspace(database, "sync-member");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");
    await seedIntegration(database, workspace.id);

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/sync-status`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );

    expect(response.status).toBe(200);
  });

  it("returns 401 without authentication", async () => {
    const app = createTestApp(database);
    const workspace = await seedWorkspace(database, "sync-unauth");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/sync-status`,
    );

    expect(response.status).toBe(401);
  });
});

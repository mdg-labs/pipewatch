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
import type { RepositorySummary } from "@pipewatch/types";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import { REPO_LIMIT_BY_PLAN } from "../../services/repositories/repository.service.js";
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

async function seedWorkspace(
  database: Db,
  slugPrefix: string,
  plan: "free" | "pro" | "business" = "pro",
): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Repositories Workspace",
      slug: `${slugPrefix}-${suffix}`,
      plan,
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
  options: { enqueueBackfillRepo?: (payload: unknown) => Promise<void> } = {},
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
    ...(options.enqueueBackfillRepo
      ? {
          enqueueBackfillRepo: options.enqueueBackfillRepo,
        }
      : {}),
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

describe("workspace repositories integration", () => {
  it("lists repositories with enabled filter and private visibility", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "repos-list");
    const workspace = await seedWorkspace(database, "repos-list");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);

    const enabledRepo = await seedRepository(database, workspace.id, integration.id, {
      fullName: "org/enabled",
      private: true,
      enabled: true,
    });
    await seedRepository(database, workspace.id, integration.id, {
      fullName: "org/disabled",
      private: false,
      enabled: false,
    });

    const listResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories?enabled=true`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as RepositorySummary[];
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: enabledRepo.id,
      private: true,
      enabled: true,
    });
  });

  it("patches repository settings with polling minimum and retention plan clamp", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "repos-patch");
    const workspace = await seedWorkspace(database, "repos-patch", "free");
    await addMember(database, workspace.id, admin.id, "admin");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id, {
      enabled: true,
      pollingIntervalSeconds: null,
      retentionDays: null,
    });

    const invalidPolling = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ polling_interval_seconds: 15 }),
      },
    );
    expect(invalidPolling.status).toBe(422);

    const invalidRetention = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ retention_days: 90 }),
      },
    );
    expect(invalidRetention.status).toBe(422);

    const patchResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          polling_interval_seconds: 60,
          retention_days: 30,
        }),
      },
    );

    expect(patchResponse.status).toBe(200);
    const updated = (await patchResponse.json()) as RepositorySummary;
    expect(updated.polling_interval_seconds).toBe(60);
    expect(updated.retention_days).toBe(30);
  });

  it("returns 403 when enabling a repo exceeds the free plan limit", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "repos-limit");
    const workspace = await seedWorkspace(database, "repos-limit", "free");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);

    const limit = REPO_LIMIT_BY_PLAN.free;
    if (limit === null) {
      throw new Error("Expected free plan repo limit");
    }

    for (let index = 0; index < limit; index += 1) {
      await seedRepository(database, workspace.id, integration.id, {
        externalRepoId: `enabled-${String(index)}`,
        fullName: `org/enabled-${String(index)}`,
        enabled: true,
      });
    }

    const blockedRepo = await seedRepository(database, workspace.id, integration.id, {
      enabled: false,
    });

    const patchResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${blockedRepo.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      },
    );

    expect(patchResponse.status).toBe(403);
  });

  it("deletes a repository and cascades pipeline runs", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "repos-delete");
    const workspace = await seedWorkspace(database, "repos-delete");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id, {
      enabled: true,
    });

    await database.insert(pipelineRuns).values({
      workspaceId: workspace.id,
      repoId: repository.id,
      externalRunId: "run-1",
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123",
      triggerType: "push",
      sourceUrl: "https://github.com/org/repo/actions/runs/1",
      startedAt: new Date(),
    });

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(204);

    const remainingRepos = await database
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.id, repository.id));
    expect(remainingRepos).toHaveLength(0);

    const remainingRuns = await database
      .select({ id: pipelineRuns.id })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, repository.id));
    expect(remainingRuns).toHaveLength(0);
  });

  it("enqueues backfill-repo on manual re-sync", async () => {
    const enqueueBackfillRepo = vi.fn(async () => undefined);
    const app = createTestApp(database, { enqueueBackfillRepo });
    const owner = await seedUser(database, "repos-sync");
    const workspace = await seedWorkspace(database, "repos-sync");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id, {
      enabled: true,
    });

    const syncResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(syncResponse.status).toBe(202);
    expect(enqueueBackfillRepo).toHaveBeenCalledOnce();
    expect(enqueueBackfillRepo).toHaveBeenCalledWith({
      repoId: repository.id,
      workspaceId: workspace.id,
      integrationId: integration.id,
    });
  });

  it("returns 403 for members mutating repositories", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "repos-guard-owner");
    const member = await seedUser(database, "repos-guard-member");
    const workspace = await seedWorkspace(database, "repos-guard");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);

    const patchResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      },
    );
    expect(patchResponse.status).toBe(403);

    const listResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );
    expect(listResponse.status).toBe(200);

    const [unchanged] = await database
      .select({ enabled: repositories.enabled })
      .from(repositories)
      .where(
        and(eq(repositories.workspaceId, workspace.id), eq(repositories.id, repository.id)),
      );
    expect(unchanged?.enabled).toBe(false);
  });
});

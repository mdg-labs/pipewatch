import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { PLAN_LIMITS } from "@pipewatch/config/plan-limits";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  repositories,
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import type { RepositorySummary, Workspace } from "@pipewatch/types";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "./error-handler.js";
import { registerInviteAcceptRoutes } from "../routes/invite/accept.js";
import { registerWorkspaceRoutes } from "../routes/workspaces/index.js";
import { signAccessToken } from "../services/auth/jwt.js";
import type { ApiEnv } from "../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

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
  APP_URL: "https://cloud.pipewatch.app",
};

async function seedUser(database: Db, loginPrefix: string) {
  const suffix = randomBytes(4).toString("hex");
  const [user] = await database
    .insert(users)
    .values({
      githubId: BigInt(`0x${randomBytes(7).toString("hex")}`),
      githubLogin: `${loginPrefix}-${suffix}`,
      email: `${loginPrefix}-${suffix}@example.com`,
      name: "Plan Limits User",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return user;
}

async function seedWorkspace(
  database: Db,
  slugPrefix: string,
  plan: "free" | "pro" | "business",
) {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Plan Limits Workspace",
      slug: `${slugPrefix}-${suffix}`,
      plan,
      defaultRetentionDays: 30,
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  return workspace;
}

async function bearerToken(
  userId: string,
  workspaceId?: string,
  role: "owner" | "admin" | "member" = "owner",
): Promise<string> {
  return signAccessToken(
    workspaceId ? { userId, workspaceId, role } : { userId },
    testSecret,
  );
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

  registerWorkspaceRoutes(app, { env, db: database });
  registerInviteAcceptRoutes(app, { env, db: database, rateLimit: { disabled: true } });

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

describe("plan limits integration (cloud)", () => {
  it("returns 403 when free plan workspace limit is exceeded", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "plan-ws-limit");

    const first = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "First Workspace" }),
    });
    expect(first.status).toBe(201);

    const second = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Second Workspace" }),
    });

    expect(second.status).toBe(403);
  });

  it("returns 403 when enabling a repo exceeds the free plan limit", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "plan-repo-limit");
    const workspace = await seedWorkspace(database, "plan-repo-limit", "free");

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      acceptedAt: new Date(),
    });

    const suffix = randomBytes(4).toString("hex");
    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-${suffix}`,
        accountLogin: `org-${suffix}`,
        accountType: "Organization",
        accessToken: "encrypted-token",
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const limit = PLAN_LIMITS.free.repoLimit;
    if (limit === null) {
      throw new Error("Expected free plan repo limit");
    }

    for (let index = 0; index < limit; index += 1) {
      await database.insert(repositories).values({
        workspaceId: workspace.id,
        integrationId: integration.id,
        externalRepoId: `enabled-${String(index)}`,
        fullName: `org/enabled-${String(index)}`,
        private: false,
        enabled: true,
      });
    }

    const [blockedRepo] = await database
      .insert(repositories)
      .values({
        workspaceId: workspace.id,
        integrationId: integration.id,
        externalRepoId: "blocked-repo",
        fullName: "org/blocked-repo",
        private: false,
        enabled: false,
      })
      .returning();

    if (!blockedRepo) {
      throw new Error("Failed to seed blocked repo");
    }

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

  it("clamps retention_days to plan max on repository PATCH", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "plan-retention-repo");
    const workspace = await seedWorkspace(database, "plan-retention-repo", "free");

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: admin.id,
      role: "admin",
      acceptedAt: new Date(),
    });

    const suffix = randomBytes(4).toString("hex");
    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: `install-${suffix}`,
        accountLogin: `org-${suffix}`,
        accountType: "Organization",
        accessToken: "encrypted-token",
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
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
        externalRepoId: "retention-repo",
        fullName: "org/retention-repo",
        private: false,
        enabled: true,
      })
      .returning();

    if (!repository) {
      throw new Error("Failed to seed repository");
    }

    const patchResponse = await app.request(
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

    expect(patchResponse.status).toBe(200);
    const updated = (await patchResponse.json()) as RepositorySummary;
    expect(updated.retention_days).toBe(PLAN_LIMITS.free.maxRetentionDays);
  });

  it("clamps default_retention_days to plan max on workspace PATCH", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "plan-retention-ws");
    const workspace = await seedWorkspace(database, "plan-retention-ws", "free");

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      acceptedAt: new Date(),
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(user.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ default_retention_days: 90 }),
      },
    );

    expect(response.status).toBe(200);
    const updated = (await response.json()) as Workspace;
    expect(updated.default_retention_days).toBe(PLAN_LIMITS.free.maxRetentionDays);
  });

  it("returns 403 when free plan member invite limit is reached", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "plan-member-limit");
    const workspace = await seedWorkspace(database, "plan-member-limit", "free");

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      acceptedAt: new Date(),
    });

    const inviteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "colleague@example.com",
          role: "member",
        }),
      },
    );

    expect(inviteResponse.status).toBe(403);
  });

  it("allows pro plan invites up to the member cap", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "plan-pro-members");
    const workspace = await seedWorkspace(database, "plan-pro-members", "pro");

    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      acceptedAt: new Date(),
    });

    const limit = PLAN_LIMITS.pro.memberLimit;
    if (limit === null) {
      throw new Error("Expected pro member limit");
    }

    for (let index = 1; index < limit; index += 1) {
      const inviteResponse = await app.request(
        `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: `member-${String(index)}@example.com`,
            role: "member",
          }),
        },
      );

      expect(inviteResponse.status).toBe(201);
    }

    const blockedInvite = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "one-too-many@example.com",
          role: "member",
        }),
      },
    );

    expect(blockedInvite.status).toBe(403);

    const pendingInvites = await database
      .select({ id: workspaceInvites.id })
      .from(workspaceInvites)
      .where(eq(workspaceInvites.workspaceId, workspace.id));

    expect(pendingInvites).toHaveLength(limit - 1);
  });
});

describe("plan limits integration (CE no-op)", () => {
  it("skips cloud plan limits when PLAN_LIMITS_ENABLED is false", async () => {
    editionMock.flags.PLAN_LIMITS_ENABLED = false;
    editionMock.flags.RETENTION_CEILING = false;

    const app = createTestApp(database);
    const user = await seedUser(database, "plan-ce-noop");

    const first = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "CE First" }),
    });
    expect(first.status).toBe(201);

    const second = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "CE Second" }),
    });
    expect(second.status).toBe(201);

    editionMock.flags.PLAN_LIMITS_ENABLED = true;
    editionMock.flags.RETENTION_CEILING = true;
  });
});

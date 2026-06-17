import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { apiKeys, users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import { API_KEY_PREFIX } from "@pipewatch/types";
import type { ApiKeySummary, CreatedApiKey } from "@pipewatch/types";
import { sha256 } from "@pipewatch/utils";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import { registerWorkspaceRoutes } from "./index.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);

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
  DATABASE_URL: "",
};

type SeedUser = {
  id: string;
};

async function seedUser(database: Db, loginPrefix: string): Promise<SeedUser> {
  const suffix = randomBytes(4).toString("hex");

  const [user] = await database
    .insert(users)
    .values({
      githubId: BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000)),
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
  plan: "free" | "pro" | "business" = "free",
): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "API Keys Workspace",
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

describe("workspace api keys integration", () => {
  it("creates a key, authenticates with it, then rejects after revoke", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "apikeys-owner");
    const workspace = await seedWorkspace(database, "apikeys-lifecycle");
    await addMember(database, workspace.id, owner.id, "owner");

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "CI pipeline" }),
      },
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as CreatedApiKey;
    expect(created.key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(created.key_prefix).toBe(created.key.slice(0, 8));
    expect(created.name).toBe("CI pipeline");
    expect(created.revoked_at).toBeNull();

    const [stored] = await database
      .select({
        keyHash: apiKeys.keyHash,
        keyPrefix: apiKeys.keyPrefix,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, created.id))
      .limit(1);

    expect(stored?.keyHash).toBe(sha256(created.key));
    expect(stored?.keyPrefix).toBe(created.key.slice(0, 8));

    const authResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members`,
      {
        headers: { Authorization: `Bearer ${created.key}` },
      },
    );
    expect(authResponse.status).toBe(200);

    const revokeResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(revokeResponse.status).toBe(204);

    const [revokedRow] = await database
      .select({ revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, created.id))
      .limit(1);
    expect(revokedRow?.revokedAt).toBeInstanceOf(Date);

    const rejectedResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members`,
      {
        headers: { Authorization: `Bearer ${created.key}` },
      },
    );
    expect(rejectedResponse.status).toBe(401);
  });

  it("lists keys with prefix only and supports optional expires_at", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "apikeys-admin");
    const workspace = await seedWorkspace(database, "apikeys-list", "pro");
    await addMember(database, workspace.id, admin.id, "admin");

    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Deploy bot", expires_at: expiresAt }),
      },
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as CreatedApiKey;
    expect(created.expires_at).toBe(expiresAt);

    const listResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
        },
      },
    );

    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as ApiKeySummary[];
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          key_prefix: created.key_prefix,
          name: "Deploy bot",
          expires_at: expiresAt,
        }),
      ]),
    );
    expect(listed.every((row) => !("key" in row))).toBe(true);
  });

  it("allows API key creation on the free cloud plan (Decision #27 stub)", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "apikeys-free");
    const workspace = await seedWorkspace(database, "apikeys-free-plan", "free");
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Free tier key" }),
      },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as CreatedApiKey;
    expect(body.key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("returns 403 for members creating or revoking keys", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "apikeys-owner-guard");
    const member = await seedUser(database, "apikeys-member-guard");
    const workspace = await seedWorkspace(database, "apikeys-guard");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Blocked key" }),
      },
    );
    expect(createResponse.status).toBe(403);

    const ownerCreate = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Owner key" }),
      },
    );
    expect(ownerCreate.status).toBe(201);
    const created = (await ownerCreate.json()) as CreatedApiKey;

    const revokeResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/api-keys/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );
    expect(revokeResponse.status).toBe(403);

    const stillActive = await database
      .select({ revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, created.id), isNotNull(apiKeys.revokedAt)));
    expect(stillActive).toHaveLength(0);
  });
});

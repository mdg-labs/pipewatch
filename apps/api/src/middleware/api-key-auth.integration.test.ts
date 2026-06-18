import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { apiKeys, users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import { API_KEY_PREFIX } from "@pipewatch/types";
import { sha256 } from "@pipewatch/utils";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { workspaceScope } from "./workspace-scope.js";
import { apiKeyAuth } from "./api-key-auth.js";
import { uniqueGithubId } from "../testing/unique-github-id.js";
import { errorHandler } from "./error-handler.js";
import { requireRole } from "./require-role.js";
import type { ApiEnv } from "../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: "b".repeat(32),
  DATABASE_URL: "",
};

type SeedResult = {
  userId: string;
  primaryWorkspaceId: string;
  secondaryWorkspaceId: string;
};

async function seedUsersWithWorkspaces(database: Db): Promise<SeedResult> {
  const suffix = randomBytes(4).toString("hex");

  const [owner] = await database
    .insert(users)
    .values({
      githubId: uniqueGithubId(),
      githubLogin: `apikey-owner-${suffix}`,
      email: `apikey-owner-${suffix}@example.com`,
      name: "API Key Owner",
    })
    .returning();

  if (!owner) {
    throw new Error("Failed to seed user");
  }

  const [primaryWorkspace] = await database
    .insert(workspaces)
    .values({
      name: "Primary Workspace",
      slug: `apikey-primary-${suffix}`,
      plan: "free",
    })
    .returning();

  const [secondaryWorkspace] = await database
    .insert(workspaces)
    .values({
      name: "Secondary Workspace",
      slug: `apikey-secondary-${suffix}`,
      plan: "free",
    })
    .returning();

  if (!primaryWorkspace || !secondaryWorkspace) {
    throw new Error("Failed to seed workspaces");
  }

  await database.insert(workspaceMembers).values({
    workspaceId: primaryWorkspace.id,
    userId: owner.id,
    role: "owner",
    acceptedAt: new Date(),
  });

  return {
    userId: owner.id,
    primaryWorkspaceId: primaryWorkspace.id,
    secondaryWorkspaceId: secondaryWorkspace.id,
  };
}

type InsertedApiKey = {
  id: string;
  rawKey: string;
};

async function insertApiKey(
  database: Db,
  options: {
    workspaceId: string;
    createdBy: string;
    rawKey: string;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
  },
): Promise<InsertedApiKey> {
  const [row] = await database
    .insert(apiKeys)
    .values({
      workspaceId: options.workspaceId,
      createdBy: options.createdBy,
      name: "CI pipeline",
      keyHash: sha256(options.rawKey),
      keyPrefix: options.rawKey.slice(0, 8),
      expiresAt: options.expiresAt ?? null,
      revokedAt: options.revokedAt ?? null,
    })
    .returning({ id: apiKeys.id });

  if (!row) {
    throw new Error("Failed to insert API key");
  }

  return { id: row.id, rawKey: options.rawKey };
}

function createApiKeyOnlyApp(database: Db) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  app.get("/api/v1/api-key-stub", apiKeyAuth({ db: database }), (c) => {
    const identity = c.get("apiKeyAuthIdentity");
    return c.json({
      workspaceId: identity?.workspaceId,
      userId: identity?.userId,
      authMode: identity?.authMode,
    });
  });

  return app;
}

function createWorkspaceScopedApp(database: Db) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "cloud",
  );

  const deps = { env, db: database };

  app.get(
    "/api/v1/workspaces/:workspaceId/scoped-stub",
    workspaceScope(deps),
    (c) => {
      const context = c.get("workspaceContext");
      return c.json({
        workspaceId: context?.workspaceId,
        role: context?.role,
        authMode: context?.authMode,
      });
    },
  );

  app.post(
    "/api/v1/workspaces/:workspaceId/admin-stub",
    workspaceScope(deps),
    requireRole("admin"),
    (c) => c.json({ ok: true }),
  );

  app.post(
    "/api/v1/workspaces/:workspaceId/owner-stub",
    workspaceScope(deps),
    requireRole("owner"),
    (c) => c.json({ ok: true }),
  );

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

describe("api key auth integration", () => {
  it("returns 401 when API key middleware receives no Authorization header", async () => {
    const app = createApiKeyOnlyApp(database);
    const response = await app.request("http://localhost:3001/api/v1/api-key-stub");

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for an invalid API key", async () => {
    const app = createApiKeyOnlyApp(database);
    const response = await app.request("http://localhost:3001/api/v1/api-key-stub", {
      headers: { Authorization: `Bearer ${API_KEY_PREFIX}invalid_key_value` },
    });

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked API key", async () => {
    const app = createApiKeyOnlyApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const rawKey = `${API_KEY_PREFIX}revoked_${randomBytes(8).toString("hex")}`;
    await insertApiKey(database, {
      workspaceId: seed.primaryWorkspaceId,
      createdBy: seed.userId,
      rawKey,
      revokedAt: new Date(),
    });

    const response = await app.request("http://localhost:3001/api/v1/api-key-stub", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(response.status).toBe(401);
  });

  it("returns 401 for an expired API key", async () => {
    const app = createApiKeyOnlyApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const rawKey = `${API_KEY_PREFIX}expired_${randomBytes(8).toString("hex")}`;
    await insertApiKey(database, {
      workspaceId: seed.primaryWorkspaceId,
      createdBy: seed.userId,
      rawKey,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await app.request("http://localhost:3001/api/v1/api-key-stub", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(response.status).toBe(401);
  });

  it("authenticates a valid API key and updates last_used_at", async () => {
    const app = createApiKeyOnlyApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const rawKey = `${API_KEY_PREFIX}valid_${randomBytes(8).toString("hex")}`;
    const inserted = await insertApiKey(database, {
      workspaceId: seed.primaryWorkspaceId,
      createdBy: seed.userId,
      rawKey,
    });

    const response = await app.request("http://localhost:3001/api/v1/api-key-stub", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: seed.primaryWorkspaceId,
      userId: seed.userId,
      authMode: "api_key",
    });

    const [row] = await database
      .select({ lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, inserted.id))
      .limit(1);

    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("resolves workspace context for a valid API key on workspace routes", async () => {
    const app = createWorkspaceScopedApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const rawKey = `${API_KEY_PREFIX}scoped_${randomBytes(8).toString("hex")}`;
    await insertApiKey(database, {
      workspaceId: seed.primaryWorkspaceId,
      createdBy: seed.userId,
      rawKey,
    });

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/scoped-stub`,
      {
        headers: { Authorization: `Bearer ${rawKey}` },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: seed.primaryWorkspaceId,
      role: "admin",
      authMode: "api_key",
    });
  });

  it("returns 403 when API key workspace does not match the route workspace", async () => {
    const app = createWorkspaceScopedApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const rawKey = `${API_KEY_PREFIX}wrong_ws_${randomBytes(8).toString("hex")}`;
    await insertApiKey(database, {
      workspaceId: seed.primaryWorkspaceId,
      createdBy: seed.userId,
      rawKey,
    });

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.secondaryWorkspaceId}/scoped-stub`,
      {
        headers: { Authorization: `Bearer ${rawKey}` },
      },
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows API keys on admin-only routes but not owner-only routes", async () => {
    const app = createWorkspaceScopedApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const rawKey = `${API_KEY_PREFIX}roles_${randomBytes(8).toString("hex")}`;
    await insertApiKey(database, {
      workspaceId: seed.primaryWorkspaceId,
      createdBy: seed.userId,
      rawKey,
    });

    const adminResponse = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/admin-stub`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${rawKey}` },
      },
    );
    expect(adminResponse.status).toBe(200);

    const ownerResponse = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/owner-stub`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${rawKey}` },
      },
    );
    expect(ownerResponse.status).toBe(403);
  });
});

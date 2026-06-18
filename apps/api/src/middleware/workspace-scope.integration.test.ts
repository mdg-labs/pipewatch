import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signAccessToken } from "../services/auth/jwt.js";
import { uniqueGithubId } from "../testing/unique-github-id.js";
import { errorHandler } from "./error-handler.js";
import { requireRole } from "./require-role.js";
import { workspaceScope } from "./workspace-scope.js";
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
  memberUserId: string;
  primaryWorkspaceId: string;
  secondaryWorkspaceId: string;
};

async function seedUsersWithWorkspaces(database: Db): Promise<SeedResult> {
  const suffix = randomBytes(4).toString("hex");

  const [owner] = await database
    .insert(users)
    .values({
      githubId: uniqueGithubId(),
      githubLogin: `scope-owner-${suffix}`,
      email: `scope-owner-${suffix}@example.com`,
      name: "Scope Owner",
    })
    .returning();

  const [member] = await database
    .insert(users)
    .values({
      githubId: uniqueGithubId(),
      githubLogin: `scope-member-${suffix}`,
      email: `scope-member-${suffix}@example.com`,
      name: "Scope Member",
    })
    .returning();

  if (!owner || !member) {
    throw new Error("Failed to seed users");
  }

  const [primaryWorkspace] = await database
    .insert(workspaces)
    .values({
      name: "Primary Workspace",
      slug: `scope-primary-${suffix}`,
      plan: "free",
    })
    .returning();

  const [secondaryWorkspace] = await database
    .insert(workspaces)
    .values({
      name: "Secondary Workspace",
      slug: `scope-secondary-${suffix}`,
      plan: "free",
    })
    .returning();

  if (!primaryWorkspace || !secondaryWorkspace) {
    throw new Error("Failed to seed workspaces");
  }

  await database.insert(workspaceMembers).values([
    {
      workspaceId: primaryWorkspace.id,
      userId: owner.id,
      role: "owner",
      acceptedAt: new Date(),
    },
    {
      workspaceId: secondaryWorkspace.id,
      userId: owner.id,
      role: "admin",
      acceptedAt: new Date(),
    },
    {
      workspaceId: primaryWorkspace.id,
      userId: member.id,
      role: "member",
      acceptedAt: new Date(),
    },
  ]);

  return {
    userId: owner.id,
    memberUserId: member.id,
    primaryWorkspaceId: primaryWorkspace.id,
    secondaryWorkspaceId: secondaryWorkspace.id,
  };
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

async function bearerToken(
  userId: string,
  workspaceId: string,
  role: "owner" | "admin" | "member",
): Promise<string> {
  return signAccessToken({ userId, workspaceId, role }, testSecret);
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

describe("workspace scope integration", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/scoped-stub`,
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when the JWT is invalid", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/scoped-stub`,
      {
        headers: { Authorization: "Bearer not-a-valid-jwt" },
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when JWT workspaceId does not match the route workspace", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const token = await bearerToken(
      seed.userId,
      seed.secondaryWorkspaceId,
      "admin",
    );

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/scoped-stub`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 when the user is not a workspace member", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const token = await bearerToken(
      seed.memberUserId,
      seed.secondaryWorkspaceId,
      "member",
    );

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.secondaryWorkspaceId}/scoped-stub`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(403);
  });

  it("allows access when JWT workspace matches and membership exists", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const token = await bearerToken(seed.userId, seed.primaryWorkspaceId, "owner");

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/scoped-stub`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: seed.primaryWorkspaceId,
      role: "owner",
      authMode: "jwt",
    });
  });

  it("returns 403 when member role hits an admin-only route", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const token = await bearerToken(
      seed.memberUserId,
      seed.primaryWorkspaceId,
      "member",
    );

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.primaryWorkspaceId}/admin-stub`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows admin role on admin-only routes", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const token = await bearerToken(
      seed.userId,
      seed.secondaryWorkspaceId,
      "admin",
    );

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.secondaryWorkspaceId}/admin-stub`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 403 when admin role hits an owner-only route", async () => {
    const app = createTestApp(database);
    const seed = await seedUsersWithWorkspaces(database);
    const token = await bearerToken(
      seed.userId,
      seed.secondaryWorkspaceId,
      "admin",
    );

    const response = await app.request(
      `http://localhost:3001/api/v1/workspaces/${seed.secondaryWorkspaceId}/owner-stub`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(403);
  });
});

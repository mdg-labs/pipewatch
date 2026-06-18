import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  refreshTokens,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createApiTestApp,
  requestApi,
  seedTestUser,
  signTestAccessToken,
} from "../../test/harness.js";
import {
  generateRefreshTokenValue,
  storeRefreshToken,
} from "../../services/auth/refresh-token.js";
import { registerUserMeRoutes } from "./me.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function createTestApp(database: Db) {
  return createApiTestApp(database, (app, context) => {
    registerUserMeRoutes(app, context);
  });
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

describe("users me integration", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = createTestApp(database);
    const response = await requestApi(app, "/api/v1/users/me");

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user profile", async () => {
    const app = createTestApp(database);
    const user = await seedTestUser(database, "profile-get");
    const token = await signTestAccessToken({ userId: user.id });

    const response = await requestApi(app, "/api/v1/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      name: user.name,
      email: user.email,
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      github_login: user.githubLogin,
    });
  });

  it("updates the user display name", async () => {
    const app = createTestApp(database);
    const user = await seedTestUser(database, "profile-patch");
    const token = await signTestAccessToken({ userId: user.id });

    const response = await requestApi(app, "/api/v1/users/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated Name" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      name: "Updated Name",
      github_login: user.githubLogin,
    });

    const [row] = await database.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(row?.name).toBe("Updated Name");
  });

  it("deletes the account when not blocked by sole-owner guard", async () => {
    const app = createTestApp(database);
    const user = await seedTestUser(database, "profile-delete-ok");
    const token = await signTestAccessToken({ userId: user.id });
    const refreshToken = generateRefreshTokenValue();
    await storeRefreshToken(database, user.id, refreshToken);

    const response = await requestApi(app, "/api/v1/users/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(204);

    const remainingUsers = await database
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(remainingUsers).toHaveLength(0);

    const activeTokens = await database
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
    expect(activeTokens).toHaveLength(0);
  });

  it("returns 409 when sole owner of a workspace with other members", async () => {
    const app = createTestApp(database);
    const owner = await seedTestUser(database, "profile-delete-blocked");
    const member = await seedTestUser(database, "profile-delete-member");
    const suffix = randomBytes(4).toString("hex");

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Shared Workspace",
        slug: `shared-workspace-${suffix}`,
        plan: "free",
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    await database.insert(workspaceMembers).values([
      {
        workspaceId: workspace.id,
        userId: owner.id,
        role: "owner",
        acceptedAt: new Date(),
      },
      {
        workspaceId: workspace.id,
        userId: member.id,
        role: "member",
        acceptedAt: new Date(),
      },
    ]);

    const token = await signTestAccessToken({ userId: owner.id });
    const response = await requestApi(app, "/api/v1/users/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "CONFLICT",
      },
    });

    const [remaining] = await database
      .select()
      .from(users)
      .where(eq(users.id, owner.id))
      .limit(1);
    expect(remaining).toBeDefined();
  });

  it("allows delete when another owner exists in the shared workspace", async () => {
    const app = createTestApp(database);
    const owner = await seedTestUser(database, "profile-delete-coowner");
    const coOwner = await seedTestUser(database, "profile-delete-coowner-2");
    const suffix = randomBytes(4).toString("hex");

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Co-owned Workspace",
        slug: `co-owned-workspace-${suffix}`,
        plan: "free",
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    await database.insert(workspaceMembers).values([
      {
        workspaceId: workspace.id,
        userId: owner.id,
        role: "owner",
        acceptedAt: new Date(),
      },
      {
        workspaceId: workspace.id,
        userId: coOwner.id,
        role: "owner",
        acceptedAt: new Date(),
      },
    ]);

    const token = await signTestAccessToken({ userId: owner.id });
    const response = await requestApi(app, "/api/v1/users/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(204);

    const [remaining] = await database
      .select()
      .from(users)
      .where(eq(users.id, owner.id))
      .limit(1);
    expect(remaining).toBeUndefined();
  });
});

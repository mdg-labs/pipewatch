import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  refreshTokens,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { verifyAccessToken } from "../../services/auth/jwt.js";
import {
  REFRESH_COOKIE_NAME,
  generateRefreshTokenValue,
  hashRefreshToken,
  storeRefreshToken,
} from "../../services/auth/refresh-token.js";
import { registerLogoutRoutes } from "./logout.js";
import { registerRefreshRoute } from "./refresh.js";
import { registerSwitchWorkspaceRoute } from "./switch-workspace.js";
import type { ApiEnv } from "../../types.js";

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
  refreshToken: string;
};

async function seedUserWithWorkspaces(database: Db): Promise<SeedResult> {
  const suffix = randomBytes(4).toString("hex");

  const [user] = await database
    .insert(users)
    .values({
      githubId: BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000)),
      githubLogin: `refresh-user-${suffix}`,
      email: `refresh-${suffix}@example.com`,
      name: "Refresh User",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  const [primaryWorkspace] = await database
    .insert(workspaces)
    .values({
      name: "Primary Workspace",
      slug: `primary-workspace-${suffix}`,
      plan: "free",
    })
    .returning();

  const [secondaryWorkspace] = await database
    .insert(workspaces)
    .values({
      name: "Secondary Workspace",
      slug: `secondary-workspace-${suffix}`,
      plan: "free",
    })
    .returning();

  if (!primaryWorkspace || !secondaryWorkspace) {
    throw new Error("Failed to seed workspaces");
  }

  await database.insert(workspaceMembers).values([
    {
      workspaceId: primaryWorkspace.id,
      userId: user.id,
      role: "owner",
      acceptedAt: new Date(),
    },
    {
      workspaceId: secondaryWorkspace.id,
      userId: user.id,
      role: "member",
      acceptedAt: new Date(),
    },
  ]);

  const refreshToken = generateRefreshTokenValue();
  await storeRefreshToken(database, user.id, refreshToken);

  return {
    userId: user.id,
    primaryWorkspaceId: primaryWorkspace.id,
    secondaryWorkspaceId: secondaryWorkspace.id,
    refreshToken,
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
  registerRefreshRoute(app, deps);
  registerLogoutRoutes(app, deps);
  registerSwitchWorkspaceRoute(app, deps);

  return app;
}

function refreshCookieHeader(token: string): string {
  return `${REFRESH_COOKIE_NAME}=${token}`;
}

function extractRefreshToken(setCookie: string | null): string {
  expect(setCookie).toBeTruthy();
  const match = setCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  expect(match?.[1]).toBeTruthy();
  return match![1]!;
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

describe("auth refresh integration", () => {
  it("rotates refresh token and rejects replay with the old token", async () => {
    const app = createTestApp(database);
    const seed = await seedUserWithWorkspaces(database);

    const refresh = await app.request("http://localhost:3001/auth/refresh", {
      method: "POST",
      headers: { Cookie: refreshCookieHeader(seed.refreshToken) },
    });

    expect(refresh.status).toBe(204);

    const newRefreshToken = extractRefreshToken(refresh.headers.get("set-cookie"));
    expect(newRefreshToken).not.toBe(seed.refreshToken);

    const activeRows = await database
      .select()
      .from(refreshTokens)
      .where(
        and(eq(refreshTokens.userId, seed.userId), isNull(refreshTokens.revokedAt)),
      );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]?.tokenHash).toBe(hashRefreshToken(newRefreshToken));
    expect(activeRows[0]?.tokenHash).not.toBe(hashRefreshToken(seed.refreshToken));

    const replay = await app.request("http://localhost:3001/auth/refresh", {
      method: "POST",
      headers: { Cookie: refreshCookieHeader(seed.refreshToken) },
    });

    expect(replay.status).toBe(401);
    const replayBody = (await replay.json()) as { error: { code: string } };
    expect(replayBody.error.code).toBe("UNAUTHORIZED");
  });

  it("revokes the current refresh token on logout", async () => {
    const app = createTestApp(database);
    const seed = await seedUserWithWorkspaces(database);

    const logout = await app.request("http://localhost:3001/auth/logout", {
      method: "POST",
      headers: { Cookie: refreshCookieHeader(seed.refreshToken) },
    });

    expect(logout.status).toBe(204);

    const [row] = await database
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(seed.refreshToken)));

    expect(row?.revokedAt).toBeTruthy();

    const refreshAfterLogout = await app.request("http://localhost:3001/auth/refresh", {
      method: "POST",
      headers: { Cookie: refreshCookieHeader(seed.refreshToken) },
    });

    expect(refreshAfterLogout.status).toBe(401);
  });

  it("revokes all refresh tokens for the user on logout-all", async () => {
    const app = createTestApp(database);
    const seed = await seedUserWithWorkspaces(database);
    const secondToken = generateRefreshTokenValue();
    await storeRefreshToken(database, seed.userId, secondToken);

    const logoutAll = await app.request("http://localhost:3001/auth/logout-all", {
      method: "POST",
      headers: { Cookie: refreshCookieHeader(seed.refreshToken) },
    });

    expect(logoutAll.status).toBe(204);

    const rows = await database
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, seed.userId));

    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.revokedAt).toBeTruthy();
    }
  });

  it("issues a new access JWT for a different workspace on switch-workspace", async () => {
    const app = createTestApp(database);
    const seed = await seedUserWithWorkspaces(database);

    const switched = await app.request("http://localhost:3001/auth/switch-workspace", {
      method: "POST",
      headers: {
        Cookie: refreshCookieHeader(seed.refreshToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workspaceId: seed.secondaryWorkspaceId }),
    });

    expect(switched.status).toBe(204);

    const setCookie = switched.headers.get("set-cookie");
    expect(setCookie).toContain("pw_access=");

    const accessMatch = setCookie!.match(/pw_access=([^;]+)/);
    expect(accessMatch?.[1]).toBeTruthy();

    const claims = await verifyAccessToken(accessMatch![1]!, testSecret);
    expect(claims.sub).toBe(seed.userId);
    expect(claims.workspaceId).toBe(seed.secondaryWorkspaceId);
    expect(claims.role).toBe("member");
  });
});

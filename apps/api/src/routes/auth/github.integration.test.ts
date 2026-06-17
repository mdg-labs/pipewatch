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
import type { GitHubUserProfile } from "@pipewatch/types";
import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { registerGitHubAuthRoutes } from "./github.js";
import type { GitHubOAuthClient } from "../../services/auth/oauth.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);
const testRefreshSecret = "b".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "ce",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: testRefreshSecret,
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "",
};

const mockProfile: GitHubUserProfile = {
  githubId: 424242n,
  githubLogin: "octocat",
  email: "octocat@example.com",
  name: "The Octocat",
  avatarUrl: "https://example.com/avatar.png",
};

function createMockOAuthClient(
  profile: GitHubUserProfile = mockProfile,
): GitHubOAuthClient {
  return {
    async exchangeCode() {
      return profile;
    },
  };
}

function createTestApp(database: Db, edition: "ce" | "cloud" = "ce") {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      PIPEWATCH_EDITION: edition,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    edition,
  );

  registerGitHubAuthRoutes(app, {
    env,
    db: database,
    oauthClient: createMockOAuthClient(),
  });

  return app;
}

async function startOAuthFlow(app: ReturnType<typeof createTestApp>, next?: string) {
  const url = next
    ? `http://localhost:3001/auth/github?next=${encodeURIComponent(next)}`
    : "http://localhost:3001/auth/github";
  const initiate = await app.request(url);

  expect(initiate.status).toBe(302);

  const location = initiate.headers.get("location");
  expect(location).toContain("github.com/login/oauth/authorize");

  const setCookie = initiate.headers.get("set-cookie");
  expect(setCookie).toContain("pw_oauth_state=");

  const state = new URL(location!).searchParams.get("state");
  expect(state).toBeTruthy();

  return {
    state: state!,
    cookieHeader: setCookie!.split(";")[0]!,
  };
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

describe("github oauth integration", () => {
  it("redirects to GitHub with a signed state cookie", async () => {
    const app = createTestApp(database);
    const { state, cookieHeader } = await startOAuthFlow(app);

    expect(state.length).toBeGreaterThan(10);
    expect(cookieHeader).toMatch(/^pw_oauth_state=/);
  });

  it("bootstraps CE first user, stores hashed refresh token, and redirects to onboarding step 2", async () => {
    const app = createTestApp(database);
    const { state, cookieHeader } = await startOAuthFlow(app);

    const callback = await app.request(
      `http://localhost:3001/auth/github/callback?code=test-code&state=${state}`,
      {
        headers: { Cookie: cookieHeader },
      },
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("http://localhost:3000/onboarding?step=2");

    const refreshCookie = callback.headers.get("set-cookie");
    expect(refreshCookie).toContain("pw_refresh=");
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Strict");

    const [userCount] = await database.select({ value: count() }).from(users);
    expect(userCount?.value).toBe(1);

    const [workspaceCount] = await database.select({ value: count() }).from(workspaces);
    expect(workspaceCount?.value).toBe(1);

    const [member] = await database
      .select()
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id));
    expect(member?.workspace_members.role).toBe("owner");
    expect(member?.workspaces.name).toBe("My Workspace");

    const tokenRows = await database.select().from(refreshTokens);
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenRows[0]?.tokenHash).not.toContain("pw_refresh");
  });

  it("redirects returning users to their workspace dashboard", async () => {
    const app = createTestApp(database);
    const { state, cookieHeader } = await startOAuthFlow(app);

    const callback = await app.request(
      `http://localhost:3001/auth/github/callback?code=returning-code&state=${state}`,
      {
        headers: { Cookie: cookieHeader },
      },
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(
      "http://localhost:3000/workspaces/my-workspace/",
    );

    const [userCount] = await database.select({ value: count() }).from(users);
    expect(userCount?.value).toBe(1);
  });

  it("honours a safe ?next= redirect when provided on initiate", async () => {
    const app = createTestApp(database);
    const { state, cookieHeader } = await startOAuthFlow(app, "/invite/token");

    const callback = await app.request(
      `http://localhost:3001/auth/github/callback?code=next-code&state=${state}`,
      {
        headers: { Cookie: cookieHeader },
      },
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("http://localhost:3000/invite/token");
  });

  it("rejects callbacks with invalid OAuth state", async () => {
    const app = createTestApp(database);
    const { cookieHeader } = await startOAuthFlow(app);

    const callback = await app.request(
      "http://localhost:3001/auth/github/callback?code=test-code&state=wrong-state",
      {
        headers: { Cookie: cookieHeader },
      },
    );

    expect(callback.status).toBe(401);
    const body = (await callback.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");

    const tokenRows = await database.select().from(refreshTokens);
    const tokenCountBefore = tokenRows.length;
    expect(tokenCountBefore).toBeGreaterThanOrEqual(1);
  });
});

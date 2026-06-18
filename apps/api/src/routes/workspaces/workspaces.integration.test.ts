import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { uniqueGithubId } from "../../testing/unique-github-id.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import { slugifyWorkspaceName } from "../../services/workspaces/workspace.service.js";
import { registerWorkspaceRoutes } from "./index.js";
import type { ApiEnv } from "../../types.js";
import type { Workspace, WorkspaceListItem } from "@pipewatch/types";

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
  githubLogin: string;
};

async function seedUser(database: Db, loginPrefix: string): Promise<SeedUser> {
  const suffix = randomBytes(4).toString("hex");

  const [user] = await database
    .insert(users)
    .values({
      githubId: uniqueGithubId(),
      githubLogin: `${loginPrefix}-${suffix}`,
      email: `${loginPrefix}-${suffix}@example.com`,
      name: "Workspace User",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return { id: user.id, githubLogin: user.githubLogin };
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
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

describe("workspaces integration (cloud)", () => {
  it("checks slug availability without authentication", async () => {
    const app = createTestApp(database);
    const suffix = randomBytes(4).toString("hex");
    const slug = `available-slug-${suffix}`;

    const response = await app.request(
      `http://localhost/api/v1/workspaces/check-slug?slug=${slug}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: true, slug });
  });

  it("reports slug unavailable when taken", async () => {
    const app = createTestApp(database);
    const suffix = randomBytes(4).toString("hex");
    const slug = `taken-slug-${suffix}`;

    await database.insert(workspaces).values({
      name: "Taken",
      slug,
      plan: "free",
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/check-slug?slug=${slug}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: false, slug });
  });

  it("creates, lists, reads, updates, and deletes a workspace", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "ws-crud");

    const createResponse = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Acme Pipelines" }),
    });

    expect(createResponse.status).toBe(201);
    const created = await readJson<Workspace>(createResponse);
    expect(created.slug).toBe(slugifyWorkspaceName("Acme Pipelines"));
    expect(created.plan).toBe("free");
    expect(created.default_retention_days).toBe(30);

    const listResponse = await app.request("http://localhost/api/v1/workspaces", {
      headers: { Authorization: `Bearer ${await bearerToken(user.id)}` },
    });

    expect(listResponse.status).toBe(200);
    const listed = await readJson<WorkspaceListItem[]>(listResponse);
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          name: "Acme Pipelines",
          role: "owner",
        }),
      ]),
    );

    const getResponse = await app.request(
      `http://localhost/api/v1/workspaces/${created.id}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(user.id, created.id, "owner")}`,
        },
      },
    );

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      id: created.id,
      slug: created.slug,
    });

    const patchResponse = await app.request(
      `http://localhost/api/v1/workspaces/${created.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(user.id, created.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Renamed Workspace" }),
      },
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      name: "Renamed Workspace",
    });

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(user.id, created.id, "owner")}`,
        },
      },
    );

    expect(deleteResponse.status).toBe(204);

    const remaining = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, created.id));
    expect(remaining).toHaveLength(0);
  });

  it("auto-resolves slug collisions on create", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "ws-collision");
    const suffix = randomBytes(4).toString("hex");
    const slug = `collision-base-${suffix}`;

    await database.insert(workspaces).values({
      name: "Existing",
      slug,
      plan: "free",
    });

    const response = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Collision Base", slug }),
    });

    expect(response.status).toBe(201);
    const body = await readJson<Workspace>(response);
    expect(body.slug).toBe(`${slug}-2`);
  });

  it("returns 409 when PATCH slug collides", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "ws-patch-collision");
    const suffix = randomBytes(4).toString("hex");
    const slugA = `workspace-a-${suffix}`;
    const slugB = `workspace-b-${suffix}`;

    const [workspaceA] = await database
      .insert(workspaces)
      .values({ name: "Workspace A", slug: slugA, plan: "pro" })
      .returning();
    const [workspaceB] = await database
      .insert(workspaces)
      .values({ name: "Workspace B", slug: slugB, plan: "pro" })
      .returning();

    if (!workspaceA || !workspaceB) {
      throw new Error("Failed to seed workspaces");
    }

    await database.insert(workspaceMembers).values([
      {
        workspaceId: workspaceA.id,
        userId: user.id,
        role: "owner",
        acceptedAt: new Date(),
      },
      {
        workspaceId: workspaceB.id,
        userId: user.id,
        role: "owner",
        acceptedAt: new Date(),
      },
    ]);

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspaceB.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(user.id, workspaceB.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: workspaceA.slug }),
      },
    );

    expect(response.status).toBe(409);
  });

  it("returns 403 when cloud free plan workspace limit is exceeded", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "ws-limit");

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
    await expect(second.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("clamps default_retention_days to plan max on free plan", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "ws-retention-free");

    const createdResponse = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Retention Free" }),
    });
    const workspace = await readJson<Workspace>(createdResponse);

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
    await expect(response.json()).resolves.toMatchObject({
      default_retention_days: 30,
    });
  });

  it("allows default_retention_days within paid plan range", async () => {
    const app = createTestApp(database);
    const user = await seedUser(database, "ws-retention-paid");
    const suffix = randomBytes(4).toString("hex");

    const [workspace] = await database
      .insert(workspaces)
      .values({
        name: "Pro Workspace",
        slug: `pro-workspace-${suffix}`,
        plan: "pro",
        defaultRetentionDays: 30,
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

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
        body: JSON.stringify({ default_retention_days: 120 }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      default_retention_days: 120,
    });
  });
});

describe("workspaces integration (CE)", () => {
  it("blocks creating a second workspace and deleting the only workspace", async () => {
    editionMock.flags.MULTI_WORKSPACE_ENABLED = false;
    editionMock.flags.PLAN_LIMITS_ENABLED = false;
    editionMock.flags.RETENTION_CEILING = false;
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;

    const app = createTestApp(database);
    const user = await seedUser(database, "ws-ce");

    const createResponse = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "CE Workspace" }),
    });

    expect(createResponse.status).toBe(201);
    const workspace = await readJson<Workspace>(createResponse);

    const secondResponse = await app.request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await bearerToken(user.id)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Second CE Workspace" }),
    });

    expect(secondResponse.status).toBe(403);

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(user.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(deleteResponse.status).toBe(409);

    editionMock.flags.MULTI_WORKSPACE_ENABLED = true;
    editionMock.flags.PLAN_LIMITS_ENABLED = true;
    editionMock.flags.RETENTION_CEILING = true;
    editionMock.flags.IS_CE = false;
    editionMock.flags.IS_CLOUD = true;
  });
});

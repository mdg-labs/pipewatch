import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import type { WorkspaceMember } from "@pipewatch/types";
import { eq, sql } from "drizzle-orm";
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
  githubLogin: string;
  email: string;
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
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return { id: user.id, githubLogin: user.githubLogin, email: user.email ?? "" };
}

type SeedWorkspace = {
  id: string;
};

async function seedWorkspace(database: Db, slugPrefix: string): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Members Workspace",
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

describe("workspace members integration", () => {
  it("lists members with profile fields for any workspace member", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-owner");
    const member = await seedUser(database, "members-member");
    const workspace = await seedWorkspace(database, "members-list");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceMember[];
    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: owner.id,
          email: owner.email,
          role: "owner",
          avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        }),
        expect.objectContaining({
          user_id: member.id,
          role: "member",
        }),
      ]),
    );
    expect(body.every((row) => typeof row.joined_at === "string")).toBe(true);
  });

  it("allows admin to change another member role", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "members-admin");
    const member = await seedUser(database, "members-promote");
    const workspace = await seedWorkspace(database, "members-patch");

    await addMember(database, workspace.id, admin.id, "admin");
    await addMember(database, workspace.id, member.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${member.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "admin" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user_id: member.id,
      role: "admin",
    });
  });

  it("returns 403 when member tries to change roles", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-owner-ro");
    const member = await seedUser(database, "members-member-ro");
    const other = await seedUser(database, "members-other-ro");
    const workspace = await seedWorkspace(database, "members-readonly");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");
    await addMember(database, workspace.id, other.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${other.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "admin" }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when member tries to upgrade their own role", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-owner-self");
    const member = await seedUser(database, "members-self-upgrade");
    const workspace = await seedWorkspace(database, "members-self-patch");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${member.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "admin" }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when admin tries to change their own role", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "members-admin-self");
    const workspace = await seedWorkspace(database, "members-admin-self");

    await addMember(database, workspace.id, admin.id, "admin");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${admin.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "owner" }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when demoting the last owner", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-last-owner");
    const workspace = await seedWorkspace(database, "members-demote");

    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${owner.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "admin" }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when demoting the last owner via another admin", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-solo-owner");
    const admin = await seedUser(database, "members-solo-admin");
    const workspace = await seedWorkspace(database, "members-solo-demote");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, admin.id, "admin");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${owner.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "member" }),
      },
    );

    expect(response.status).toBe(409);
  });

  it("removes a member and returns 204", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-remove-owner");
    const member = await seedUser(database, "members-remove-target");
    const workspace = await seedWorkspace(database, "members-delete");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${member.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(204);

    const remaining = await database
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, member.id));
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 when member tries to remove another member", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-del-owner");
    const member = await seedUser(database, "members-del-member");
    const other = await seedUser(database, "members-del-other");
    const workspace = await seedWorkspace(database, "members-del-forbidden");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");
    await addMember(database, workspace.id, other.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${other.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when removing the last owner", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "members-del-last-owner");
    const workspace = await seedWorkspace(database, "members-del-last");

    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/members/${owner.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(409);
  });
});

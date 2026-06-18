import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { users, workspaceInvites, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { registerInviteAcceptRoutes } from "../invite/accept.js";
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
  APP_URL: "https://cloud.pipewatch.app",
};

type SeedUser = {
  id: string;
  email: string;
};

async function seedUser(database: Db, loginPrefix: string, email?: string): Promise<SeedUser> {
  const suffix = randomBytes(4).toString("hex");
  const resolvedEmail = email ?? `${loginPrefix}-${suffix}@example.com`;

  const [user] = await database
    .insert(users)
    .values({
      githubId: BigInt(`0x${randomBytes(7).toString("hex")}`),
      githubLogin: `${loginPrefix}-${suffix}`,
      email: resolvedEmail,
      name: "Workspace User",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return { id: user.id, email: resolvedEmail };
}

type SeedWorkspace = {
  id: string;
};

async function seedWorkspace(database: Db, slugPrefix: string): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Invites Workspace",
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
  registerInviteAcceptRoutes(app, { env, db: database });

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

describe("workspace invites integration", () => {
  it("creates an invite with 7-day expiry and returns invite_url when SMTP is unset", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "invites-admin");
    const workspace = await seedWorkspace(database, "invites-create");
    await addMember(database, workspace.id, admin.id, "admin");

    const inviteEmail = `invitee-${randomBytes(4).toString("hex")}@example.com`;

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      email: string;
      role: string;
      invited_at: string;
      expires_at: string;
      email_sent: boolean;
      invite_url?: string;
    };

    expect(body.email).toBe(inviteEmail);
    expect(body.role).toBe("member");
    expect(body.email_sent).toBe(false);
    expect(body.invite_url).toMatch(/^https:\/\/cloud\.pipewatch\.app\/invite\/[0-9a-f-]{36}$/);

    const expiresAt = new Date(body.expires_at);
    const invitedAt = new Date(body.invited_at);
    const diffDays = (expiresAt.getTime() - invitedAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);

    const [row] = await database
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.id, body.id));
    expect(row?.token).toBeTruthy();
    expect(row?.acceptedAt).toBeNull();
  });

  it("lists pending invites for admin", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "invites-list-owner");
    const workspace = await seedWorkspace(database, "invites-list");
    await addMember(database, workspace.id, owner.id, "owner");

    const inviteEmail = `pending-${randomBytes(4).toString("hex")}@example.com`;
    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: "admin" }),
      },
    );
    expect(createResponse.status).toBe(201);

    const listResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(listResponse.status).toBe(200);
    const invites = (await listResponse.json()) as Array<{ email: string; role: string }>;
    expect(invites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: inviteEmail,
          role: "admin",
        }),
      ]),
    );
  });

  it("validates and accepts an invite through the public flow", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "invites-accept-admin");
    const inviteEmail = `accept-${randomBytes(4).toString("hex")}@example.com`;
    const invitee = await seedUser(database, "invites-accept-user", inviteEmail);
    const workspace = await seedWorkspace(database, "invites-accept");

    await addMember(database, workspace.id, admin.id, "admin");

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      },
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { invite_url: string };
    const token = created.invite_url.split("/invite/")[1];
    if (!token) {
      throw new Error("Expected invite token in invite_url");
    }

    const validateResponse = await app.request(`http://localhost/invite/${token}`);
    expect(validateResponse.status).toBe(200);
    await expect(validateResponse.json()).resolves.toMatchObject({
      workspace_id: workspace.id,
      workspace_name: "Invites Workspace",
      email: inviteEmail,
      role: "member",
    });

    const acceptResponse = await app.request(`http://localhost/invite/${token}/accept`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await signAccessToken({ userId: invitee.id }, testSecret)}`,
      },
    });

    expect(acceptResponse.status).toBe(200);
    await expect(acceptResponse.json()).resolves.toMatchObject({
      workspace_id: workspace.id,
      role: "member",
    });

    const [membership] = await database
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, invitee.id),
          isNotNull(workspaceMembers.acceptedAt),
        ),
      );
    expect(membership?.role).toBe("member");

    const [inviteRow] = await database
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.token, token));
    expect(inviteRow?.acceptedAt).not.toBeNull();

    const revalidate = await app.request(`http://localhost/invite/${token}`);
    expect(revalidate.status).toBe(409);
  });

  it("resends an invite and returns invite_url when SMTP is unset", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "invites-resend-owner");
    const workspace = await seedWorkspace(database, "invites-resend");
    await addMember(database, workspace.id, owner.id, "owner");

    const inviteEmail = `resend-${randomBytes(4).toString("hex")}@example.com`;
    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      },
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string; invite_url: string };

    const resendResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites/${created.id}/resend`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(resendResponse.status).toBe(200);
    const resent = (await resendResponse.json()) as {
      email_sent: boolean;
      invite_url?: string;
    };
    expect(resent.email_sent).toBe(false);
    expect(resent.invite_url).toBe(created.invite_url);
  });

  it("revokes a pending invite", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "invites-revoke-admin");
    const workspace = await seedWorkspace(database, "invites-revoke");
    await addMember(database, workspace.id, admin.id, "admin");

    const inviteEmail = `revoke-${randomBytes(4).toString("hex")}@example.com`;
    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      },
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(204);

    const remaining = await database
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.id, created.id));
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 when member tries to create invites", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "invites-ro-owner");
    const member = await seedUser(database, "invites-ro-member");
    const workspace = await seedWorkspace(database, "invites-readonly");

    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `blocked-${randomBytes(4).toString("hex")}@example.com`,
          role: "member",
        }),
      },
    );

    expect(response.status).toBe(403);
  });
});

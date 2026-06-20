import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAdminEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  adminInvites,
  adminSessions,
  adminUsers,
} from "@pipewatch/db-admin/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { bootstrapAdminUser } from "../../services/auth/bootstrap.js";
import { hashPassword } from "../../services/auth/password.js";
import { createSession } from "../../services/auth/session.js";
import { ADMIN_SESSION_COOKIE } from "../../services/auth/session-token.js";
import { buildAdminInviteUrl } from "../../services/mail/invite.js";
import postgres from "postgres";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "c".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ADMIN_SESSION_SECRET: testSecret,
  ADMIN_URL: "https://admin.pipewatch.app",
  ADMIN_BOOTSTRAP_EMAIL: "bootstrap@pipewatch.app",
  ADMIN_BOOTSTRAP_PASSWORD: "bootstrap-password-123",
  DATABASE_URL: "",
};

let containerId = "";
let database: Db;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(url: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = postgres(url, { max: 1 });
      await probe`select 1`;
      await probe.end({ timeout: 5 });
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Postgres container did not become ready in time");
}

function createTestApp(db: Db, overrides: Record<string, string> = {}) {
  const env = parseAdminEnv({ ...baseEnv, ...overrides, DATABASE_URL: process.env.DATABASE_URL });
  return createApp({ env, db }, null);
}

async function seedAdminUser(
  db: Db,
  params: {
    email: string;
    password: string;
    role: "viewer" | "operator" | "platform_admin";
  },
): Promise<{ id: string }> {
  const passwordHash = await hashPassword(params.password);

  const [user] = await db
    .insert(adminUsers)
    .values({
      email: params.email,
      passwordHash,
      role: params.role,
    })
    .returning({ id: adminUsers.id });

  if (!user) {
    throw new Error("Failed to seed admin user");
  }

  return user;
}

async function login(
  app: ReturnType<typeof createTestApp>,
  email: string,
  password: string,
): Promise<string> {
  const response = await app.request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  expect(response.status).toBe(200);

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Expected session cookie");
  }

  return setCookie.split(";")[0] ?? "";
}

beforeAll(async () => {
  const port = 56000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--label",
      "pipewatch-test=admin-auth",
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

  execSync("pnpm --filter @pipewatch/db-admin db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });

  database = createDb(databaseUrl);
}, 120_000);

afterAll(async () => {
  await closeDb();

  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }
});

describe("admin platform auth", () => {
  it("bootstraps the first platform_admin only once", async () => {
    await database.delete(adminUsers);

    await bootstrapAdminUser(database, parseAdminEnv(baseEnv));
    await bootstrapAdminUser(database, parseAdminEnv(baseEnv));

    const users = await database.select().from(adminUsers);
    expect(users).toHaveLength(1);
    expect(users[0]?.email).toBe("bootstrap@pipewatch.app");
    expect(users[0]?.role).toBe("platform_admin");
  });

  it("logs in and returns a protected status payload", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `login-${suffix}@pipewatch.app`;
    const password = "login-password-123";

    await seedAdminUser(database, { email, password, role: "operator" });

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const statusResponse = await app.request("http://localhost/api/v1/status", {
      headers: { cookie },
    });

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({
      status: "ok",
      service: "admin",
      user: {
        email,
        role: "operator",
      },
    });
  });

  it("rejects expired sessions", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `expired-${suffix}@pipewatch.app`;
    const password = "expired-password-123";

    const user = await seedAdminUser(database, {
      email,
      password,
      role: "viewer",
    });

    const session = await createSession(database, user.id, testSecret);
    await database
      .update(adminSessions)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(adminSessions.id, session.sessionId));

    const app = createTestApp(database);
    const cookie = [ADMIN_SESSION_COOKIE, session.cookieValue].join("=");

    const statusResponse = await app.request("http://localhost/api/v1/status", {
      headers: { cookie },
    });

    expect(statusResponse.status).toBe(401);
    await expect(statusResponse.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Session expired",
      },
    });
  });

  it("returns 403 when a viewer manages invites", async () => {
    const suffix = randomBytes(4).toString("hex");
    const email = `viewer-${suffix}@pipewatch.app`;
    const password = "viewer-password-123";

    await seedAdminUser(database, { email, password, role: "viewer" });

    const app = createTestApp(database);
    const cookie = await login(app, email, password);

    const response = await app.request("http://localhost/api/admin/invites", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: `invitee-${suffix}@pipewatch.app`,
        role: "viewer",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
  });

  it("accepts an invite and starts a session", async () => {
    const suffix = randomBytes(4).toString("hex");
    const adminEmail = `admin-${suffix}@pipewatch.app`;
    const inviteeEmail = `invitee-${suffix}@pipewatch.app`;
    const adminPassword = "admin-password-123";
    const inviteePassword = "invitee-password-123";

    const admin = await seedAdminUser(database, {
      email: adminEmail,
      password: adminPassword,
      role: "platform_admin",
    });

    const app = createTestApp(database);
    const cookie = await login(app, adminEmail, adminPassword);

    const createResponse = await app.request("http://localhost/api/admin/invites", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: inviteeEmail,
        role: "operator",
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { invite_url?: string };
    if (!created.invite_url) {
      throw new Error("Expected invite_url when SMTP is unset");
    }

    const token = new URL(created.invite_url).searchParams.get("token");
    if (!token) {
      throw new Error("Expected invite token in invite_url");
    }

    expect(created.invite_url).toBe(buildAdminInviteUrl(baseEnv.ADMIN_URL, token));

    const acceptResponse = await app.request("http://localhost/api/auth/accept-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        password: inviteePassword,
      }),
    });

    expect(acceptResponse.status).toBe(200);
    await expect(acceptResponse.json()).resolves.toMatchObject({
      user: {
        email: inviteeEmail,
        role: "operator",
      },
    });

    const [inviteRow] = await database
      .select({ acceptedAt: adminInvites.acceptedAt, invitedBy: adminInvites.invitedBy })
      .from(adminInvites)
      .where(eq(adminInvites.email, inviteeEmail))
      .limit(1);

    expect(inviteRow?.acceptedAt).not.toBeNull();
    expect(inviteRow?.invitedBy).toBe(admin.id);
  });
});

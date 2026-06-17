import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { decrypt } from "@pipewatch/utils";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import { registerGitHubInstallCallbackRoute } from "./github-callback.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);
const encryptionKey = "c".repeat(32);
let testPrivateKey = "";

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: "b".repeat(32),
  ENCRYPTION_KEY: encryptionKey,
  GITHUB_APP_ID: "123456",
  get GITHUB_APP_PRIVATE_KEY() {
    return testPrivateKey;
  },
  GITHUB_WEBHOOK_SECRET: "d".repeat(32),
  APP_URL: "http://localhost:3000",
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
      name: "Callback User",
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

async function seedWorkspace(database: Db, slugPrefix: string): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Callback Workspace",
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

function createMockGitHubFetch(installationId: string) {
  const token = `ghs_${randomBytes(8).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (
      method === "GET" &&
      url === `https://api.github.com/app/installations/${installationId}`
    ) {
      return new Response(
        JSON.stringify({
          account: {
            login: "mdg-labs",
            type: "Organization",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      method === "POST" &&
      url === `https://api.github.com/app/installations/${installationId}/access_tokens`
    ) {
      return new Response(JSON.stringify({ token, expires_at: expiresAt }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

function createTestApp(
  database: Db,
  options: {
    fetchImpl: typeof fetch;
    enqueueBackfill: ReturnType<typeof vi.fn>;
  },
) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "cloud",
  );

  registerGitHubInstallCallbackRoute(app, {
    env,
    db: database,
    fetchImpl: options.fetchImpl,
    enqueueBackfill: options.enqueueBackfill,
  });

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
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  testPrivateKey = privateKey;

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

describe("GitHub install callback integration", () => {
  it("creates an integration, enqueues backfill, and redirects to onboarding step 3", async () => {
    const installationId = String(900000 + Math.floor(Math.random() * 100000));
    const enqueueBackfill = vi.fn(async () => undefined);
    const app = createTestApp(database, {
      fetchImpl: createMockGitHubFetch(installationId),
      enqueueBackfill,
    });

    const owner = await seedUser(database, "callback-owner");
    const workspace = await seedWorkspace(database, "callback-create");
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
        redirect: "manual",
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding?step=3");

    const [row] = await database
      .select()
      .from(integrations)
      .where(eq(integrations.externalInstallationId, installationId))
      .limit(1);

    expect(row?.workspaceId).toBe(workspace.id);
    expect(row?.accountLogin).toBe("mdg-labs");
    expect(row?.accountType).toBe("Organization");
    expect(decrypt(row?.accessToken ?? "", encryptionKey)).toMatch(/^ghs_/);

    expect(enqueueBackfill).toHaveBeenCalledOnce();
    expect(enqueueBackfill).toHaveBeenCalledWith({
      integrationId: row?.id,
      workspaceId: workspace.id,
    });
  });

  it("updates an existing integration for the same workspace", async () => {
    const installationId = String(910000 + Math.floor(Math.random() * 100000));
    const enqueueBackfill = vi.fn(async () => undefined);
    const app = createTestApp(database, {
      fetchImpl: createMockGitHubFetch(installationId),
      enqueueBackfill,
    });

    const admin = await seedUser(database, "callback-admin");
    const workspace = await seedWorkspace(database, "callback-update");
    await addMember(database, workspace.id, admin.id, "admin");

    const authHeader = {
      Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
    };

    const first = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      { headers: authHeader, redirect: "manual" },
    );
    expect(first.status).toBe(302);

    const second = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      { headers: authHeader, redirect: "manual" },
    );
    expect(second.status).toBe(302);

    const rows = await database
      .select({ id: integrations.id })
      .from(integrations)
      .where(eq(integrations.externalInstallationId, installationId));

    expect(rows).toHaveLength(1);
    expect(enqueueBackfill).toHaveBeenCalledTimes(2);
  });

  it("returns 409 when the installation belongs to another workspace", async () => {
    const installationId = String(920000 + Math.floor(Math.random() * 100000));
    const enqueueBackfill = vi.fn(async () => undefined);
    const app = createTestApp(database, {
      fetchImpl: createMockGitHubFetch(installationId),
      enqueueBackfill,
    });

    const ownerA = await seedUser(database, "callback-owner-a");
    const ownerB = await seedUser(database, "callback-owner-b");
    const workspaceA = await seedWorkspace(database, "callback-a");
    const workspaceB = await seedWorkspace(database, "callback-b");
    await addMember(database, workspaceA.id, ownerA.id, "owner");
    await addMember(database, workspaceB.id, ownerB.id, "owner");

    const first = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(ownerA.id, workspaceA.id, "owner")}`,
        },
        redirect: "manual",
      },
    );
    expect(first.status).toBe(302);

    const second = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(ownerB.id, workspaceB.id, "owner")}`,
        },
        redirect: "manual",
      },
    );
    expect(second.status).toBe(409);
    expect(enqueueBackfill).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated and member requests", async () => {
    const installationId = String(930000 + Math.floor(Math.random() * 100000));
    const enqueueBackfill = vi.fn(async () => undefined);
    const app = createTestApp(database, {
      fetchImpl: createMockGitHubFetch(installationId),
      enqueueBackfill,
    });

    const unauthenticated = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      { redirect: "manual" },
    );
    expect(unauthenticated.status).toBe(401);

    const owner = await seedUser(database, "callback-guard-owner");
    const member = await seedUser(database, "callback-guard-member");
    const workspace = await seedWorkspace(database, "callback-guard");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const memberResponse = await app.request(
      `http://localhost/onboarding/github-callback?installation_id=${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
        redirect: "manual",
      },
    );
    expect(memberResponse.status).toBe(403);
    expect(enqueueBackfill).not.toHaveBeenCalled();
  });

  it("validates installation_id format", async () => {
    const enqueueBackfill = vi.fn(async () => undefined);
    const app = createTestApp(database, {
      fetchImpl: createMockGitHubFetch("12345"),
      enqueueBackfill,
    });

    const owner = await seedUser(database, "callback-invalid");
    const workspace = await seedWorkspace(database, "callback-invalid");
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      "http://localhost/onboarding/github-callback?installation_id=not-numeric",
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
        redirect: "manual",
      },
    );

    expect(response.status).toBe(422);
    expect(enqueueBackfill).not.toHaveBeenCalled();
  });
});

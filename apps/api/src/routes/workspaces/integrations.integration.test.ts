import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { integrations, repositories, users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import type { CreateIntegrationInput, IntegrationSummary } from "@pipewatch/types";
import { decrypt } from "@pipewatch/utils";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { uniqueGithubId } from "../../testing/unique-github-id.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import { TOKEN_REFRESH_BUFFER_MS } from "../../services/github/app-auth.js";
import { computeTokenHealth } from "../../services/integrations/integration.service.js";
import { registerWorkspaceRoutes } from "./index.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);
const encryptionKey = "c".repeat(32);

let testPrivateKey = "";

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
  ENCRYPTION_KEY: encryptionKey,
  GITHUB_APP_ID: "123456",
  get GITHUB_APP_PRIVATE_KEY() {
    return testPrivateKey;
  },
  GITHUB_WEBHOOK_SECRET: "d".repeat(32),
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
      githubId: uniqueGithubId(),
      githubLogin: `${loginPrefix}-${suffix}`,
      email: `${loginPrefix}-${suffix}@example.com`,
      name: "Workspace User",
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
      name: "Integrations Workspace",
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

function installationPayload(overrides: Partial<CreateIntegrationInput> = {}): CreateIntegrationInput {
  const suffix = randomBytes(4).toString("hex");
  return {
    external_installation_id: `install-${suffix}`,
    account_login: `org-${suffix}`,
    account_type: "Organization",
    access_token: `ghs_${suffix}`,
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    provider: "github",
    ...overrides,
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

describe("workspace integrations integration", () => {
  it("creates, lists, fetches, and deletes an integration lifecycle", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "integrations-owner");
    const workspace = await seedWorkspace(database, "integrations-lifecycle");
    await addMember(database, workspace.id, owner.id, "owner");

    const payload = installationPayload();

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as IntegrationSummary;
    expect(created.provider).toBe("github");
    expect(created.external_installation_id).toBe(payload.external_installation_id);
    expect(created.account_login).toBe(payload.account_login);
    expect(created.account_type).toBe("Organization");
    expect(created.connected_repo_count).toBe(0);
    expect(created.token_health).toBe("healthy");

    const [stored] = await database
      .select({
        accessToken: integrations.accessToken,
        provider: integrations.provider,
      })
      .from(integrations)
      .where(eq(integrations.id, created.id))
      .limit(1);

    expect(stored?.provider).toBe("github");
    expect(decrypt(stored?.accessToken ?? "", encryptionKey)).toBe(payload.access_token);

    await database.insert(repositories).values([
      {
        workspaceId: workspace.id,
        integrationId: created.id,
        externalRepoId: "1001",
        fullName: `${payload.account_login}/alpha`,
        private: false,
        enabled: true,
      },
      {
        workspaceId: workspace.id,
        integrationId: created.id,
        externalRepoId: "1002",
        fullName: `${payload.account_login}/beta`,
        private: true,
        enabled: false,
      },
    ]);

    const listResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as IntegrationSummary[];
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          account_login: payload.account_login,
          account_type: "Organization",
          connected_repo_count: 1,
          token_health: "healthy",
        }),
      ]),
    );

    const getResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations/${created.id}`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(getResponse.status).toBe(200);
    const detail = (await getResponse.json()) as IntegrationSummary;
    expect(detail.connected_repo_count).toBe(1);

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(204);

    const remainingIntegrations = await database
      .select({ id: integrations.id })
      .from(integrations)
      .where(eq(integrations.id, created.id));
    expect(remainingIntegrations).toHaveLength(0);

    const remainingRepos = await database
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.integrationId, created.id));
    expect(remainingRepos).toHaveLength(0);
  });

  it("reports expiring token health when near expiry", () => {
    const nearExpiry = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS - 1_000);
    expect(computeTokenHealth(nearExpiry)).toBe("expiring");
    expect(computeTokenHealth(new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS + 60_000))).toBe(
      "healthy",
    );
    expect(computeTokenHealth(new Date(Date.now() - 1_000))).toBe("expired");
    expect(computeTokenHealth(null)).toBe("expired");
  });

  it("returns 403 for members mutating integrations", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "integrations-owner-guard");
    const member = await seedUser(database, "integrations-member-guard");
    const workspace = await seedWorkspace(database, "integrations-guard");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, member.id, "member");

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(installationPayload()),
      },
    );
    expect(createResponse.status).toBe(403);

    const ownerCreate = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(installationPayload()),
      },
    );
    expect(ownerCreate.status).toBe(201);
    const created = (await ownerCreate.json()) as IntegrationSummary;

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(403);

    const stillPresent = await database
      .select({ id: integrations.id })
      .from(integrations)
      .where(eq(integrations.id, created.id));
    expect(stillPresent).toHaveLength(1);
  });

  it("returns 409 when the same installation is connected twice", async () => {
    const app = createTestApp(database);
    const admin = await seedUser(database, "integrations-dup");
    const workspace = await seedWorkspace(database, "integrations-dup");
    await addMember(database, workspace.id, admin.id, "admin");

    const payload = installationPayload();

    const first = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    expect(first.status).toBe(201);

    const second = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    expect(second.status).toBe(409);
  });

  it("disables repositories before deleting the integration", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "integrations-disable");
    const workspace = await seedWorkspace(database, "integrations-disable");
    await addMember(database, workspace.id, owner.id, "owner");

    const createResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(installationPayload()),
      },
    );
    const created = (await createResponse.json()) as IntegrationSummary;

    await database.insert(repositories).values({
      workspaceId: workspace.id,
      integrationId: created.id,
      externalRepoId: "2001",
      fullName: "org/repo",
      private: false,
      enabled: true,
    });

    const deleteResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/integrations/${created.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(deleteResponse.status).toBe(204);

    const orphanedRepos = await database
      .select({ id: repositories.id, enabled: repositories.enabled })
      .from(repositories)
      .where(
        and(eq(repositories.workspaceId, workspace.id), eq(repositories.integrationId, created.id)),
      );
    expect(orphanedRepos).toHaveLength(0);
  });
});

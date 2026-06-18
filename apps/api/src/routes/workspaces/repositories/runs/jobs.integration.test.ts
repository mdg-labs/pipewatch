import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineJobs,
  pipelineRuns,
  pipelineSteps,
  repositories,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import type { PipelineJobsList, PipelineStepsList } from "@pipewatch/types";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { signAccessToken } from "../../../../services/auth/jwt.js";
import { registerWorkspaceRoutes } from "../../index.js";
import type { ApiEnv } from "../../../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../../..");

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

type SeedWorkspace = {
  id: string;
};

type SeedIntegration = {
  id: string;
};

type SeedRepository = {
  id: string;
};

type SeedRun = {
  id: string;
};

type SeedJob = {
  id: string;
};

async function seedUser(database: Db, loginPrefix: string): Promise<SeedUser> {
  const suffix = randomBytes(4).toString("hex");
  const githubId = BigInt(`0x${randomBytes(7).toString("hex")}`);

  const [user] = await database
    .insert(users)
    .values({
      githubId,
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

async function seedWorkspace(database: Db, slugPrefix: string): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Jobs Workspace",
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

async function seedIntegration(database: Db, workspaceId: string): Promise<SeedIntegration> {
  const suffix = randomBytes(4).toString("hex");
  const [integration] = await database
    .insert(integrations)
    .values({
      workspaceId,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: `org-${suffix}`,
      accountType: "Organization",
      accessToken: "encrypted-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: integrations.id });

  if (!integration) {
    throw new Error("Failed to seed integration");
  }

  return { id: integration.id };
}

async function seedRepository(
  database: Db,
  workspaceId: string,
  integrationId: string,
): Promise<SeedRepository> {
  const suffix = randomBytes(4).toString("hex");
  const [repository] = await database
    .insert(repositories)
    .values({
      workspaceId,
      integrationId,
      externalRepoId: `repo-${suffix}`,
      fullName: `org/repo-${suffix}`,
      private: false,
      enabled: true,
    })
    .returning({ id: repositories.id });

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return { id: repository.id };
}

async function seedRun(
  database: Db,
  workspaceId: string,
  repoId: string,
  overrides: Partial<typeof pipelineRuns.$inferInsert> = {},
): Promise<SeedRun> {
  const suffix = randomBytes(4).toString("hex");
  const [run] = await database
    .insert(pipelineRuns)
    .values({
      workspaceId,
      repoId,
      externalRunId: `external-${suffix}`,
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123",
      commitMessage: "feat: add jobs API",
      actorLogin: "dev-user",
      triggerType: "push",
      sourceUrl: `https://github.com/org/repo/actions/runs/${suffix}`,
      startedAt: new Date("2026-06-10T12:00:00.000Z"),
      completedAt: new Date("2026-06-10T12:05:00.000Z"),
      durationMs: 300_000,
      ...overrides,
    })
    .returning({ id: pipelineRuns.id });

  if (!run) {
    throw new Error("Failed to seed pipeline run");
  }

  return { id: run.id };
}

async function seedJob(
  database: Db,
  workspaceId: string,
  runId: string,
  overrides: Partial<typeof pipelineJobs.$inferInsert> = {},
): Promise<SeedJob> {
  const suffix = randomBytes(4).toString("hex");
  const [job] = await database
    .insert(pipelineJobs)
    .values({
      workspaceId,
      runId,
      externalJobId: `job-${suffix}`,
      name: "build",
      status: "completed",
      conclusion: "success",
      runnerName: "ubuntu-latest",
      startedAt: new Date("2026-06-10T12:01:00.000Z"),
      completedAt: new Date("2026-06-10T12:03:00.000Z"),
      durationMs: 120_000,
      ...overrides,
    })
    .returning({ id: pipelineJobs.id });

  if (!job) {
    throw new Error("Failed to seed pipeline job");
  }

  return { id: job.id };
}

async function seedStep(
  database: Db,
  jobId: string,
  overrides: Partial<typeof pipelineSteps.$inferInsert> = {},
): Promise<{ id: string }> {
  const [step] = await database
    .insert(pipelineSteps)
    .values({
      jobId,
      number: 1,
      name: "Checkout",
      status: "completed",
      conclusion: "success",
      startedAt: new Date("2026-06-10T12:01:00.000Z"),
      completedAt: new Date("2026-06-10T12:01:30.000Z"),
      durationMs: 30_000,
      ...overrides,
    })
    .returning({ id: pipelineSteps.id });

  if (!step) {
    throw new Error("Failed to seed pipeline step");
  }

  return { id: step.id };
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

  registerWorkspaceRoutes(app, {
    env,
    db: database,
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

describe("workspace pipeline jobs routes", () => {
  it("lists jobs ordered by started_at for DAG display", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "jobs-list");
    const workspace = await seedWorkspace(database, "jobs-list");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);
    const run = await seedRun(database, workspace.id, repository.id);

    const laterJob = await seedJob(database, workspace.id, run.id, {
      externalJobId: "job-later",
      name: "deploy",
      startedAt: new Date("2026-06-10T12:04:00.000Z"),
      runnerName: "macos-latest",
      durationMs: 60_000,
    });
    const earlierJob = await seedJob(database, workspace.id, run.id, {
      externalJobId: "job-earlier",
      name: "lint",
      startedAt: new Date("2026-06-10T12:02:00.000Z"),
      runnerName: "ubuntu-latest",
      durationMs: 45_000,
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}/jobs`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PipelineJobsList;
    expect(body.data).toHaveLength(2);
    expect(body.data[0]?.id).toBe(earlierJob.id);
    expect(body.data[1]?.id).toBe(laterJob.id);
    expect(body.data[0]).toMatchObject({
      workspace_id: workspace.id,
      run_id: run.id,
      runner_name: "ubuntu-latest",
      status: "completed",
      duration_ms: 45_000,
    });
    expect(body.data[1]).toMatchObject({
      runner_name: "macos-latest",
      duration_ms: 60_000,
    });
  });

  it("lists steps ordered by number", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "steps-list");
    const workspace = await seedWorkspace(database, "steps-list");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);
    const run = await seedRun(database, workspace.id, repository.id);
    const job = await seedJob(database, workspace.id, run.id);

    const stepTwo = await seedStep(database, job.id, {
      number: 2,
      name: "Run tests",
      durationMs: 90_000,
    });
    const stepOne = await seedStep(database, job.id, {
      number: 1,
      name: "Install deps",
      durationMs: 15_000,
    });

    const response = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}/jobs/${job.id}/steps`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PipelineStepsList;
    expect(body.data).toHaveLength(2);
    expect(body.data[0]?.id).toBe(stepOne.id);
    expect(body.data[1]?.id).toBe(stepTwo.id);
    expect(body.data[0]).toMatchObject({
      job_id: job.id,
      number: 1,
      name: "Install deps",
      status: "completed",
      duration_ms: 15_000,
    });
    expect(body.data[1]).toMatchObject({
      number: 2,
      name: "Run tests",
      duration_ms: 90_000,
    });
  });

  it("returns 404 when repository is not in the workspace", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "jobs-ws-isolation");
    const workspace = await seedWorkspace(database, "jobs-ws-isolation");
    const otherWorkspace = await seedWorkspace(database, "jobs-other-ws");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, otherWorkspace.id);
    const repository = await seedRepository(database, otherWorkspace.id, integration.id);
    const run = await seedRun(database, otherWorkspace.id, repository.id);
    const job = await seedJob(database, otherWorkspace.id, run.id);

    const jobsResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}/jobs`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(jobsResponse.status).toBe(404);

    const stepsResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}/jobs/${job.id}/steps`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(stepsResponse.status).toBe(404);
  });

  it("returns 404 when run or job does not exist in scope", async () => {
    const app = createTestApp(database);
    const owner = await seedUser(database, "jobs-not-found");
    const workspace = await seedWorkspace(database, "jobs-not-found");
    await addMember(database, workspace.id, owner.id, "owner");
    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);
    const run = await seedRun(database, workspace.id, repository.id);

    const missingRunResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${randomUUID()}/jobs`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(missingRunResponse.status).toBe(404);

    const missingJobResponse = await app.request(
      `http://localhost/api/v1/workspaces/${workspace.id}/repositories/${repository.id}/runs/${run.id}/jobs/${randomUUID()}/steps`,
      {
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );
    expect(missingJobResponse.status).toBe(404);
  });
});

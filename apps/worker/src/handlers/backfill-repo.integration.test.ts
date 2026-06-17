import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseWorkerEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineRuns,
  repositories,
  workspaces,
} from "@pipewatch/db/schema";
import type { GitHubWorkflowRun } from "@pipewatch/utils";
import { encrypt } from "@pipewatch/utils";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { backfillRepo } from "./backfill-repo.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixturesDir = join(
  repoRoot,
  "packages/utils/src/github/fixtures",
);

const encryptionKey = "c".repeat(32);

const workerEnv = parseWorkerEnv({
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ENCRYPTION_KEY: encryptionKey,
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "unused-for-tests",
  RETENTION_DAYS: "30",
});

function loadFixtureRun(name: string): GitHubWorkflowRun {
  const raw = readFileSync(join(fixturesDir, name), "utf8");
  const payload = JSON.parse(raw) as { workflow_run: GitHubWorkflowRun };
  return payload.workflow_run;
}

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

type SeedContext = {
  workspaceId: string;
  integrationId: string;
  repoId: string;
  fullName: string;
};

async function seedRepository(database: Db): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");
  const fullName = `org-${suffix}/hello-world`;
  const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Backfill Workspace",
      slug: `backfill-${suffix}`,
      plan: "pro",
      defaultRetentionDays: 30,
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  const [integration] = await database
    .insert(integrations)
    .values({
      workspaceId: workspace.id,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: `org-${suffix}`,
      accountType: "organization",
      accessToken: encrypt("ghs_test_token", encryptionKey),
      tokenExpiresAt,
    })
    .returning();

  if (!integration) {
    throw new Error("Failed to seed integration");
  }

  const [repository] = await database
    .insert(repositories)
    .values({
      workspaceId: workspace.id,
      integrationId: integration.id,
      externalRepoId: `repo-${suffix}`,
      fullName,
      private: false,
      enabled: true,
    })
    .returning();

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return {
    workspaceId: workspace.id,
    integrationId: integration.id,
    repoId: repository.id,
    fullName,
  };
}

function createMockWorkflowRunsFetch(
  fullName: string,
  pages: GitHubWorkflowRun[][],
) {
  const calls: string[] = [];

  const fetchImpl = vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);

    const pageMatch = /[?&]page=(\d+)/.exec(url);
    const page = pageMatch ? Number(pageMatch[1]) : 1;
    const runs = pages[page - 1] ?? [];

    if (!url.includes(`/repos/${fullName}/actions/runs`)) {
      return new Response("not found", { status: 404 });
    }

    return new Response(
      JSON.stringify({
        total_count: pages.flat().length,
        workflow_runs: runs,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  return { fetchImpl, calls };
}

function createJob<T>(data: T) {
  let jobData = data;

  return {
    data: jobData,
    updateData: vi.fn(async (next: T) => {
      jobData = next;
      return undefined;
    }),
    get currentData() {
      return jobData;
    },
  };
}

let containerId = "";
let database: Db;

beforeAll(async () => {
  const port = 57000 + Math.floor(Math.random() * 5000);
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

describe("backfill-repo integration", () => {
  it("ingests paginated workflow runs and updates last_synced_at", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");
    const runTwo = loadFixtureRun("workflow-run-in-progress.json");
    runTwo.id = 2891501298;

    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      ...runOne,
      id: 2_891_501_300 + index,
    }));

    const { fetchImpl, calls } = createMockWorkflowRunsFetch(seed.fullName, [
      fullPage,
      [runTwo],
    ]);

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(101);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("page=1");
    expect(calls[0]).toContain("created=%3E%3D");
    expect(calls[1]).toContain("page=2");

    const runs = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, seed.repoId));

    expect(runs).toHaveLength(101);
    expect(runs.some((run) => run.externalRunId === "2891501298")).toBe(true);

    const [repository] = await database
      .select()
      .from(repositories)
      .where(eq(repositories.id, seed.repoId));

    expect(repository?.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("resumes from a stored runsPage cursor", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");
    const runTwo = loadFixtureRun("workflow-run-in-progress.json");
    runTwo.id = 2891501299;

    const { fetchImpl, calls } = createMockWorkflowRunsFetch(seed.fullName, [
      [runOne],
      [runTwo],
    ]);

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
      runsPage: 2,
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("page=2");

    const [run] = await database
      .select()
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.repoId, seed.repoId),
          eq(pipelineRuns.externalRunId, "2891501299"),
        ),
      );

    expect(run).toBeDefined();
  });

  it("skips disabled repositories", async () => {
    const seed = await seedRepository(database);
    await database
      .update(repositories)
      .set({ enabled: false })
      .where(eq(repositories.id, seed.repoId));

    const fetchImpl = vi.fn(async () => new Response("unexpected", { status: 500 }));

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

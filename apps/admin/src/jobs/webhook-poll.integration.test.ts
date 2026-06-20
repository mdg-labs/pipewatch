import { execSync, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAdminEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { integrations, workspaces } from "@pipewatch/db/schema";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { runWebhookPollJob } from "./webhook-poll.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

let containerId = "";
let database: Db;
let testPrivateKey = "";

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

function buildMockFetch(
  pages: Array<{ deliveries: unknown[]; nextCursor?: string }>,
): typeof fetch {
  let callIndex = 0;

  const mockFetch = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const page = pages[callIndex];
    callIndex += 1;

    if (!page) {
      throw new Error(`Unexpected fetch call: ${url}`);
    }

    const headers = new Headers({
      "content-type": "application/json",
    });

    if (page.nextCursor) {
      headers.set(
        "link",
        `<https://api.github.com/app/hook/deliveries?cursor=${page.nextCursor}&per_page=100>; rel="next"`,
      );
    }

    return new Response(JSON.stringify(page.deliveries), {
      status: 200,
      headers,
    });
  };

  return mockFetch as typeof fetch;
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
      "--label",
      "pipewatch-test=admin-webhook-poll",
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

describe("webhook poll job integration", () => {
  it("upserts deliveries with installation mapping and orphan rows", async () => {
    const [workspace] = await database
      .insert(workspaces)
      .values({ slug: "acme", name: "Acme" })
      .returning();

    if (!workspace) {
      throw new Error("Failed to seed workspace");
    }

    const [integration] = await database
      .insert(integrations)
      .values({
        workspaceId: workspace.id,
        provider: "github",
        externalInstallationId: "424242",
        accountLogin: "acme",
        accountType: "Organization",
        accessToken: "encrypted-token",
      })
      .returning();

    if (!integration) {
      throw new Error("Failed to seed integration");
    }

    const env = parseAdminEnv({
      NODE_ENV: "development",
      PIPEWATCH_EDITION: "cloud",
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: testPrivateKey,
    });

    const deliveredAt = "2026-06-20T10:00:00Z";

    const count = await runWebhookPollJob({
      env,
      db: database,
      fetchImpl: buildMockFetch([
        {
          deliveries: [
            {
              id: 9001,
              guid: "guid-matched",
              delivered_at: deliveredAt,
              redelivery: false,
              duration: 0.42,
              status: "OK",
              status_code: 200,
              event: "workflow_run",
              action: "completed",
              installation_id: 424242,
            },
            {
              id: 9002,
              guid: "guid-orphan",
              delivered_at: deliveredAt,
              redelivery: false,
              duration: 0.0,
              status: "Failed to connect",
              status_code: 0,
              event: "workflow_job",
              action: null,
              installation_id: 999999,
            },
          ],
        },
      ]),
    });

    expect(count).toBe(2);

    const rows = await database
      .select()
      .from(webhookDeliveries)
      .orderBy(webhookDeliveries.githubDeliveryId);

    expect(rows).toHaveLength(2);

    const matched = rows.find((row) => row.githubDeliveryId === "9001");
    expect(matched?.workspaceId).toBe(workspace.id);
    expect(matched?.integrationId).toBe(integration.id);
    expect(matched?.externalInstallationId).toBe("424242");
    expect(matched?.statusCode).toBe(200);

    const orphan = rows.find((row) => row.githubDeliveryId === "9002");
    expect(orphan?.workspaceId).toBeNull();
    expect(orphan?.integrationId).toBeNull();
    expect(orphan?.externalInstallationId).toBe("999999");
    expect(orphan?.statusCode).toBe(0);

    const [beforeRePoll] = await database
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.githubDeliveryId, "9001"));

    await runWebhookPollJob({
      env,
      db: database,
      fetchImpl: buildMockFetch([
        {
          deliveries: [
            {
              id: 9001,
              guid: "guid-matched",
              delivered_at: deliveredAt,
              redelivery: true,
              duration: 0.55,
              status: "OK",
              status_code: 200,
              event: "workflow_run",
              action: "completed",
              installation_id: 424242,
            },
          ],
        },
      ]),
    });

    const [rePolled] = await database
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.githubDeliveryId, "9001"));

    expect(rePolled?.redelivery).toBe(true);
    expect(rePolled?.duration).toBe(0.55);
    expect(rePolled?.polledAt.getTime()).toBeGreaterThan(
      beforeRePoll?.polledAt.getTime() ?? 0,
    );
  });

  it("paginates through all GitHub delivery pages", async () => {
    const env = parseAdminEnv({
      NODE_ENV: "development",
      PIPEWATCH_EDITION: "cloud",
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: testPrivateKey,
    });

    const count = await runWebhookPollJob({
      env,
      db: database,
      fetchImpl: buildMockFetch([
        {
          deliveries: [
            {
              id: 8001,
              guid: "guid-page-1",
              delivered_at: "2026-06-20T09:00:00Z",
              redelivery: false,
              duration: 0.1,
              status: "OK",
              status_code: 200,
              event: "push",
              action: null,
              installation_id: null,
            },
          ],
          nextCursor: "page-2",
        },
        {
          deliveries: [
            {
              id: 8002,
              guid: "guid-page-2",
              delivered_at: "2026-06-20T09:01:00Z",
              redelivery: false,
              duration: 0.2,
              status: "Not Found",
              status_code: 404,
              event: "push",
              action: null,
              installation_id: null,
            },
          ],
        },
      ]),
    });

    expect(count).toBe(2);

    const rows = await database
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.githubDeliveryId, "8002"));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.statusCode).toBe(404);
  });
});

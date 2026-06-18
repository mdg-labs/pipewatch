import { spawnSync } from "node:child_process";

import { QueueEvents, Worker } from "bullmq";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(() => "event-id"),
  init: vi.fn(),
}));

import * as Sentry from "@sentry/node";

import { attachPermanentFailureHandler } from "./dead-letter.js";
import { createRedisConnection } from "./connection.js";
import {
  closeAllQueues,
  defaultJobOptionsFor,
  getQueue,
  QUEUE_NAMES,
  resolveBackoffDelay,
} from "./index.js";

let containerId = "";
let redisUrl = "";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForRedis(url: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = getQueue(QUEUE_NAMES.MAINTENANCE, url);
      await probe.getJobCounts();
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Redis container did not become ready in time");
}

beforeAll(async () => {
  const port = 56000 + Math.floor(Math.random() * 5000);
  const run = spawnSync(
    "docker",
    ["run", "-d", "--rm", "-p", `${String(port)}:6379`, "redis:7-alpine"],
    { encoding: "utf8" },
  );

  if (run.status !== 0) {
    throw new Error(run.stderr || "Failed to start Redis container");
  }

  containerId = run.stdout.trim();
  redisUrl = `redis://127.0.0.1:${String(port)}`;
  process.env.REDIS_URL = redisUrl;

  await waitForRedis(redisUrl);
}, 120_000);

afterAll(async () => {
  await closeAllQueues();

  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }
});

describe("BullMQ queue infrastructure integration", () => {
  it("registers all processor queues with PRD retry defaults", () => {
    for (const queueName of [
      QUEUE_NAMES.WEBHOOK_EVENTS,
      QUEUE_NAMES.BACKFILL,
      QUEUE_NAMES.POLLING,
      QUEUE_NAMES.MAINTENANCE,
    ] as const) {
      const queue = getQueue(queueName, redisUrl);
      expect(queue.name).toBe(queueName);
    }

    const webhookOpts = defaultJobOptionsFor(QUEUE_NAMES.WEBHOOK_EVENTS);
    expect(webhookOpts.attempts).toBe(3);
    expect(webhookOpts.priority).toBe(10);

    const backfillOpts = defaultJobOptionsFor(QUEUE_NAMES.BACKFILL);
    expect(backfillOpts.attempts).toBe(5);
    expect(backfillOpts.priority).toBe(1);
  });

  it("applies custom backoff delays per queue", () => {
    expect(resolveBackoffDelay(QUEUE_NAMES.WEBHOOK_EVENTS, 1)).toBe(1000);
    expect(resolveBackoffDelay(QUEUE_NAMES.WEBHOOK_EVENTS, 2)).toBe(5000);
    expect(resolveBackoffDelay(QUEUE_NAMES.WEBHOOK_EVENTS, 3)).toBe(30_000);

    expect(resolveBackoffDelay(QUEUE_NAMES.BACKFILL, 5)).toBe(1_800_000);
  });

  it("enqueues and processes a job through Redis", async () => {
    const queue = getQueue(QUEUE_NAMES.WEBHOOK_EVENTS, redisUrl);
    const events = new QueueEvents(queue.name, {
      connection: createRedisConnection(redisUrl),
    });

    const worker = new Worker(
      queue.name,
      async (job) => ({ echo: job.data }),
      { connection: createRedisConnection(redisUrl) },
    );

    const completed = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Job did not complete in time"));
      }, 10_000);

      events.on("completed", ({ returnvalue }) => {
        clearTimeout(timeout);
        resolve(returnvalue);
      });
    });

    await worker.waitUntilReady();
    const job = await queue.add("process-pipeline-run", { runId: "run-1" });
    expect(job.id).toBeTruthy();

    const result = await completed;
    expect(result).toEqual({ echo: { runId: "run-1" } });

    await worker.close();
    await events.close();
  });

  it("moves permanently failed jobs to dead-letter and alerts Sentry", async () => {
    vi.mocked(Sentry.captureException).mockClear();

    const queue = getQueue(QUEUE_NAMES.POLLING, redisUrl);
    const deadLetterQueue = getQueue(QUEUE_NAMES.DEAD_LETTER, redisUrl);
    const events = new QueueEvents(queue.name, {
      connection: createRedisConnection(redisUrl),
    });

    const worker = new Worker(
      queue.name,
      async (): Promise<void> => {
        throw new Error("poll failed permanently");
      },
      {
        connection: createRedisConnection(redisUrl),
        settings: {
          backoffStrategy: (attemptsMade) =>
            resolveBackoffDelay(QUEUE_NAMES.POLLING, attemptsMade),
        },
      },
    );

    attachPermanentFailureHandler(worker, redisUrl);

    const failed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Job did not fail in time"));
      }, 15_000);

      events.on("failed", ({ failedReason }) => {
        if (failedReason === "poll failed permanently") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    await worker.waitUntilReady();
    await queue.add(
      "poll-repo",
      { repoId: "repo-1" },
      {
        attempts: 1,
        backoff: { type: "custom" },
      },
    );

    await failed;
    await sleep(500);

    const deadLetterJobs = await deadLetterQueue.getJobs(["waiting", "delayed", "active"]);
    expect(deadLetterJobs.length).toBeGreaterThan(0);
    expect(deadLetterJobs[0]?.data.originalQueue).toBe(QUEUE_NAMES.POLLING);
    expect(Sentry.captureException).toHaveBeenCalled();

    await worker.close();
    await events.close();
  }, 20_000);
});

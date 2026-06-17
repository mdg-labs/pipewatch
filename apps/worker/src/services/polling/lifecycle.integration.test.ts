import { spawnSync } from "node:child_process";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POLL_REPO_JOB_NAME, pollRepeatableJobId } from "../../queues/polling.js";
import { closeAllQueues, getQueue, QUEUE_NAMES } from "../../queues/index.js";
import {
  DEFAULT_POLLING_INTERVAL_SECONDS,
  addPollingRepeatable,
  removePollingRepeatable,
  resolveEffectivePollingIntervalSeconds,
  syncPollingLifecycle,
} from "./lifecycle.js";

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

function countPollRepeatables(redis: string): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.POLLING, redis);
  return queue.getRepeatableJobs().then((jobs) => jobs.filter((job) => job.name === POLL_REPO_JOB_NAME).length);
}

const baseState = {
  repoId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  integrationId: "33333333-3333-4333-8333-333333333333",
  enabled: true,
  pollingIntervalSeconds: 60,
} as const;

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

describe("polling lifecycle integration", () => {
  beforeEach(async () => {
    await removePollingRepeatable(redisUrl, baseState.repoId, [30, 60, 90, DEFAULT_POLLING_INTERVAL_SECONDS]);
  });

  it("resolves effective interval with CE global polling override", () => {
    expect(resolveEffectivePollingIntervalSeconds(null, "webhook")).toBeNull();
    expect(resolveEffectivePollingIntervalSeconds(45, "webhook")).toBe(45);
    expect(resolveEffectivePollingIntervalSeconds(null, "polling")).toBe(
      DEFAULT_POLLING_INTERVAL_SECONDS,
    );
  });

  it("adds a repeatable poll-repo job per repository", async () => {
    await removePollingRepeatable(redisUrl, baseState.repoId, [60]);
    await addPollingRepeatable(redisUrl, { ...baseState }, "webhook");

    expect(await countPollRepeatables(redisUrl)).toBe(1);

    const queue = getQueue(QUEUE_NAMES.POLLING, redisUrl);
    const repeatables = await queue.getRepeatableJobs();
    const match = repeatables.find((job) => job.name === POLL_REPO_JOB_NAME);

    expect(match).toBeDefined();
    expect(Number(match?.every)).toBe(60_000);
  });

  it("removes repeatable when switching back to webhook mode", async () => {
    await syncPollingLifecycle(redisUrl, "webhook", { ...baseState });
    expect(await countPollRepeatables(redisUrl)).toBe(1);

    await syncPollingLifecycle(
      redisUrl,
      "webhook",
      {
        ...baseState,
        pollingIntervalSeconds: null,
      },
      { ...baseState },
    );

    expect(await countPollRepeatables(redisUrl)).toBe(0);
  });

  it("removes repeatable when repository is disabled", async () => {
    await syncPollingLifecycle(redisUrl, "webhook", { ...baseState });
    await syncPollingLifecycle(
      redisUrl,
      "webhook",
      { ...baseState, enabled: false },
      { ...baseState },
    );

    expect(await countPollRepeatables(redisUrl)).toBe(0);
  });

  it("refreshes repeatable when polling interval changes", async () => {
    await syncPollingLifecycle(
      redisUrl,
      "webhook",
      { ...baseState, pollingIntervalSeconds: 30 },
    );

    await syncPollingLifecycle(
      redisUrl,
      "webhook",
      { ...baseState, pollingIntervalSeconds: 90 },
      { ...baseState, pollingIntervalSeconds: 30 },
    );

    const queue = getQueue(QUEUE_NAMES.POLLING, redisUrl);
    const repeatables = await queue.getRepeatableJobs();
    const match = repeatables.find((job) => job.name === POLL_REPO_JOB_NAME);

    expect(Number(match?.every)).toBe(90_000);
    expect(repeatables.filter((job) => job.name === POLL_REPO_JOB_NAME)).toHaveLength(1);
  });

  it("schedules polling with global CE override when interval is null", async () => {
    await removePollingRepeatable(redisUrl, baseState.repoId, [DEFAULT_POLLING_INTERVAL_SECONDS]);

    await syncPollingLifecycle(redisUrl, "polling", {
      ...baseState,
      pollingIntervalSeconds: null,
    });

    const queue = getQueue(QUEUE_NAMES.POLLING, redisUrl);
    const repeatables = await queue.getRepeatableJobs();
    const match = repeatables.find((job) => job.name === POLL_REPO_JOB_NAME);

    expect(Number(match?.every)).toBe(DEFAULT_POLLING_INTERVAL_SECONDS * 1000);
    expect(pollRepeatableJobId(baseState.repoId)).toBe(`poll:${baseState.repoId}`);
  });
});

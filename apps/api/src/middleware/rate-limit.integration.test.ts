import { spawnSync } from "node:child_process";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "./error-handler.js";
import { checkRateLimit, createRateLimitMiddleware } from "./rate-limit.js";
import { registerRefreshRoute } from "../routes/auth/refresh.js";
import type { ApiEnv } from "../types.js";

const testSecret = "a".repeat(32);

let redisContainerId = "";
let redisUrl = "";
let redis: Redis;

async function waitForRedis(url: string, attempts = 30): Promise<void> {
  const probe = new Redis(url, { maxRetriesPerRequest: null });
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await probe.ping();
      await probe.quit();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  await probe.quit();
  throw new Error("Redis container did not become ready in time");
}

function createTestApp() {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      NODE_ENV: "development",
      PIPEWATCH_EDITION: "ce",
      JWT_SECRET: testSecret,
      JWT_REFRESH_SECRET: "b".repeat(32),
      REDIS_URL: redisUrl,
    },
    "ce",
  );

  const rateLimit = {
    redis,
    env,
    config: { max: 2, windowSeconds: 60 },
  } as const;

  registerRefreshRoute(app, { env, rateLimit });

  app.use(
    "/limited",
    createRateLimitMiddleware("auth", rateLimit),
  );
  app.get("/limited", (c) => c.json({ ok: true }));

  return app;
}

beforeAll(async () => {
  const port = 57000 + Math.floor(Math.random() * 5000);
  const run = spawnSync(
    "docker",
    ["run", "-d", "--rm", "-p", `${String(port)}:6379`, "redis:7-alpine"],
    { encoding: "utf8" },
  );

  if (run.status !== 0) {
    throw new Error(run.stderr || "Failed to start Redis container");
  }

  redisContainerId = run.stdout.trim();
  redisUrl = `redis://127.0.0.1:${String(port)}`;
  await waitForRedis(redisUrl);
  redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
});

afterAll(async () => {
  if (redis) {
    await redis.quit();
  }

  if (redisContainerId) {
    spawnSync("docker", ["stop", redisContainerId], { stdio: "pipe" });
  }
});

describe("checkRateLimit", () => {
  it("allows requests up to the configured max", async () => {
    await redis.del("pw:rl:auth:test-ip");

    const config = { max: 2, windowSeconds: 60 };
    const first = await checkRateLimit(redis, "auth", "test-ip", config);
    const second = await checkRateLimit(redis, "auth", "test-ip", config);
    const third = await checkRateLimit(redis, "auth", "test-ip", config);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    if (!third.allowed) {
      expect(third.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});

describe("rate limit middleware integration", () => {
  it("returns 429 with Retry-After on /auth/refresh after exceeding the per-IP limit", async () => {
    const app = createTestApp();

    const first = await app.request("http://localhost/auth/refresh", { method: "POST" });
    const second = await app.request("http://localhost/auth/refresh", { method: "POST" });
    const third = await app.request("http://localhost/auth/refresh", { method: "POST" });

    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBeTruthy();

    const body = (await third.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBe("Too many requests");
  });

  it("returns 429 with Retry-After on generic middleware routes", async () => {
    const app = createTestApp();

    const first = await app.request("/limited");
    const second = await app.request("/limited");
    const third = await app.request("/limited");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBeTruthy();
  });
});

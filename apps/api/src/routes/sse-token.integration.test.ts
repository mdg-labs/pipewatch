import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../services/auth/jwt.js";
import {
  SSE_TOKEN_KEY_PREFIX,
  consumeSseToken,
} from "../services/sse-token.js";
import { registerSseTokenRoute } from "./sse-token.js";
import type { ApiEnv } from "../types.js";

const testSecret = "a".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: "b".repeat(32),
  REDIS_URL: "",
};

let redisContainerId = "";
let redisUrl = "";
let redis: Redis;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForRedis(url: string, attempts = 30): Promise<void> {
  const probe = new Redis(url, { maxRetriesPerRequest: null });

  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const pong = await probe.ping();
        if (pong === "PONG") {
          return;
        }
      } catch {
        await sleep(500);
      }
    }

    throw new Error("Redis container did not become ready in time");
  } finally {
    await probe.quit();
  }
}

function createTestApp() {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      REDIS_URL: redisUrl,
    },
    "cloud",
  );

  registerSseTokenRoute(app, { env, redis });

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
  baseEnv.REDIS_URL = redisUrl;

  await waitForRedis(redisUrl);
  redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
}, 120_000);

afterAll(async () => {
  if (redis) {
    await redis.quit();
  }

  if (redisContainerId) {
    spawnSync("docker", ["stop", redisContainerId], { stdio: "pipe" });
  }
});

describe("GET /api/v1/sse-token integration", () => {
  it("returns a one-time token for authenticated JWT requests", async () => {
    const app = createTestApp();
    const userId = randomBytes(16).toString("hex");
    const accessToken = await signAccessToken({ userId }, testSecret);

    const response = await app.request("/api/v1/sse-token", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { token: string; expiresIn: number };
    expect(body.expiresIn).toBe(60);
    expect(body.token.length).toBeGreaterThan(0);

    const stored = await redis.get(`${SSE_TOKEN_KEY_PREFIX}${body.token}`);
    expect(stored).toBe(JSON.stringify({ userId }));
  });

  it("rejects unauthenticated requests", async () => {
    const app = createTestApp();

    const response = await app.request("/api/v1/sse-token");

    expect(response.status).toBe(401);
  });

  it("consumes tokens exactly once", async () => {
    const app = createTestApp();
    const userId = randomBytes(16).toString("hex");
    const workspaceId = randomBytes(16).toString("hex");
    const accessToken = await signAccessToken({ userId, workspaceId, role: "member" }, testSecret);

    const response = await app.request("/api/v1/sse-token", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { token: string; expiresIn: number };

    const firstConsume = await consumeSseToken(redis, body.token);
    expect(firstConsume).toEqual({ userId, workspaceId });

    const secondConsume = await consumeSseToken(redis, body.token);
    expect(secondConsume).toBeNull();

    const stored = await redis.get(`${SSE_TOKEN_KEY_PREFIX}${body.token}`);
    expect(stored).toBeNull();
  });
});

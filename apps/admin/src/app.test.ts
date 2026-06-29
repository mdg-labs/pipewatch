import { describe, expect, it, vi } from "vitest";

import { parseAdminEnv } from "@pipewatch/config/env";

import packageJson from "../package.json" with { type: "json" };

import { createApp } from "./app.js";

const testSecret = "a".repeat(32);

const env = parseAdminEnv({
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ADMIN_SESSION_SECRET: testSecret,
  ADMIN_URL: "https://admin.pipewatch.app",
});

const db = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
} as never;

describe("createApp", () => {
  it("returns 200 from /health", async () => {
    const app = createApp({ env, db }, null);
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      edition: "cloud",
    });
  });

  it("returns 200 from /version", async () => {
    const app = createApp({ env, db }, null);
    const response = await app.request("/version");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: packageJson.version,
    });
  });

  it("returns 401 from /api/v1/status without a session", async () => {
    const app = createApp({ env, db }, null);
    const response = await app.request("/api/v1/status");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });
});

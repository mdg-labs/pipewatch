import { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { registerAppConfigRoute } from "./app-config.js";
import type { ApiEnv } from "../../types.js";

function createTestApp(env: ParsedApiEnv) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);
  registerAppConfigRoute(app, { env });
  return app;
}

const baseEnv = {
  NODE_ENV: "development",
  PIPEWATCH_MODE: "webhook",
  PORT: 3000,
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  REDIS_URL: "redis://127.0.0.1:6379",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  JWT_SECRET: "0123456789abcdef0123456789abcdef",
  JWT_REFRESH_SECRET: "0123456789abcdef0123456789abcdef",
  GITHUB_APP_ID: "1",
  GITHUB_APP_PRIVATE_KEY: "test-key",
  GITHUB_WEBHOOK_SECRET: "webhook-secret",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  APP_URL: "https://cloud.pipewatch.app",
  MARKETING_URL: "https://pipewatch.app",
  PUBLIC_API_URL: "https://api.pipewatch.app",
} satisfies ParsedApiEnv;

describe("app config integration", () => {
  it("returns github_app_slug from runtime env", async () => {
    const app = createTestApp({
      ...baseEnv,
      GITHUB_APP_SLUG: "my-custom-app",
    });
    const response = await app.request("http://localhost/api/v1/public/app-config");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      github_app_slug: "my-custom-app",
    });
  });

  it("returns null when GITHUB_APP_SLUG is unset", async () => {
    const app = createTestApp(baseEnv);
    const response = await app.request("http://localhost/api/v1/public/app-config");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      github_app_slug: null,
    });
  });

  it("returns null when GITHUB_APP_SLUG is blank", async () => {
    const app = createTestApp({
      ...baseEnv,
      GITHUB_APP_SLUG: "   ",
    });
    const response = await app.request("http://localhost/api/v1/public/app-config");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      github_app_slug: null,
    });
  });
});

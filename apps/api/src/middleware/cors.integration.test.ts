import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { createCorsMiddleware } from "./cors.js";
import type { ApiEnv } from "../types.js";

const allowedAppOrigin = "http://localhost:3000";
const allowedMarketingOrigin = "https://pipewatch.app";
const disallowedOrigin = "https://evil.example.com";

function createTestApp() {
  const app = new OpenAPIHono<ApiEnv>();
  app.use("*", createCorsMiddleware({
    APP_URL: allowedAppOrigin,
    MARKETING_URL: allowedMarketingOrigin,
  }));

  app.options("/auth/refresh", (c) => c.body(null, 204));
  app.post("/auth/refresh", (c) => c.json({ ok: true }));
  app.options("/api/v1/workspaces/:workspaceId", (c) => c.body(null, 204));
  app.get("/api/v1/workspaces/:workspaceId", (c) => c.json({ ok: true }));

  return app;
}

async function preflight(
  app: ReturnType<typeof createTestApp>,
  path: string,
  origin: string,
): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    }),
  );
}

describe("CORS integration", () => {
  const app = createTestApp();

  it.each([
    ["/auth/refresh", allowedAppOrigin],
    ["/auth/refresh", allowedMarketingOrigin],
    ["/api/v1/workspaces/ws_123", allowedAppOrigin],
  ])("allows preflight for %s from %s", async (path, origin) => {
    const response = await preflight(app, path, origin);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it.each([
    ["/auth/refresh"],
    ["/api/v1/workspaces/ws_123"],
  ])("blocks preflight for disallowed origin on %s", async (path) => {
    const response = await preflight(app, path, disallowedOrigin);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("reflects allowed origin on credentialed GET", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/v1/workspaces/ws_123", {
        method: "GET",
        headers: {
          Origin: allowedAppOrigin,
        },
        credentials: "include",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedAppOrigin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not reflect disallowed origin on credentialed GET", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/v1/workspaces/ws_123", {
        method: "GET",
        headers: {
          Origin: disallowedOrigin,
        },
        credentials: "include",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

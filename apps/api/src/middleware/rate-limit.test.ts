import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { resolveClientIp, RATE_LIMIT_DEFAULTS } from "./rate-limit.js";

describe("resolveClientIp", () => {
  it("prefers the first X-Forwarded-For hop", async () => {
    const app = new OpenAPIHono();
    app.get("/ip", (c) => c.json({ ip: resolveClientIp(c) }));

    const response = await app.request("/ip", {
      headers: { "X-Forwarded-For": "203.0.113.1, 10.0.0.1" },
    });

    expect(await response.json()).toEqual({ ip: "203.0.113.1" });
  });

  it("falls back to X-Real-IP", async () => {
    const app = new OpenAPIHono();
    app.get("/ip", (c) => c.json({ ip: resolveClientIp(c) }));

    const response = await app.request("/ip", {
      headers: { "X-Real-IP": "198.51.100.2" },
    });

    expect(await response.json()).toEqual({ ip: "198.51.100.2" });
  });
});

describe("RATE_LIMIT_DEFAULTS", () => {
  it("defines sensible per-bucket defaults", () => {
    expect(RATE_LIMIT_DEFAULTS.auth.max).toBeGreaterThan(0);
    expect(RATE_LIMIT_DEFAULTS.webhook.max).toBeGreaterThan(RATE_LIMIT_DEFAULTS.waitlist.max);
  });
});

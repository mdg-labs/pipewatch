import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("createApp", () => {
  it("returns 200 from /health", async () => {
    const app = createApp(null);
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      edition: "cloud",
    });
  });

  it("returns 200 from /api/v1/status", async () => {
    const app = createApp(null);
    const response = await app.request("/api/v1/status");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "admin",
    });
  });
});

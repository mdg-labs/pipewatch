import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };

import { createProbeApp } from "./probe-server.js";

describe("worker probe routes", () => {
  const app = createProbeApp();

  it("GET /health returns ok with edition", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      edition: expect.stringMatching(/^(ce|cloud)$/) as string,
    });
  });

  it("GET /version returns package.json semver", async () => {
    const response = await app.request("/version");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: packageJson.version,
    });
  });
});

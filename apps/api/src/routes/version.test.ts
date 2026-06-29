import { describe, expect, it } from "vitest";

import packageJson from "../../package.json" with { type: "json" };

import { createApp } from "../app.js";

describe("GET /version", () => {
  it("returns package.json semver", async () => {
    const app = createApp();
    const response = await app.request("/version");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: packageJson.version,
    });
  });
});

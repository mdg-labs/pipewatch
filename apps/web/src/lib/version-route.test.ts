import { describe, expect, it } from "vitest";

import packageJson from "../../package.json" with { type: "json" };

import { GET } from "../../app/version/route.js";

describe("GET /version", () => {
  it("returns package.json semver", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      version: packageJson.version,
    });
  });
});

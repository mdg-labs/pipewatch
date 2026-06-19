import { describe, expect, it } from "vitest";

import { buildCorsAllowlist, normalizeOrigin } from "./cors.js";

describe("normalizeOrigin", () => {
  it("strips path and trailing slash from configured URLs", () => {
    expect(normalizeOrigin("https://cloud.pipewatch.app/onboarding")).toBe(
      "https://cloud.pipewatch.app",
    );
    expect(normalizeOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
  });
});

describe("buildCorsAllowlist", () => {
  it("includes APP_URL and MARKETING_URL origins without duplicates", () => {
    expect(
      buildCorsAllowlist({
        APP_URL: "https://cloud.pipewatch.app",
        MARKETING_URL: "https://pipewatch.app",
      }),
    ).toEqual(["https://cloud.pipewatch.app", "https://pipewatch.app"]);
  });

  it("omits unset URLs", () => {
    expect(
      buildCorsAllowlist({
        APP_URL: "http://localhost:3000",
        MARKETING_URL: undefined,
      }),
    ).toEqual(["http://localhost:3000"]);
  });
});

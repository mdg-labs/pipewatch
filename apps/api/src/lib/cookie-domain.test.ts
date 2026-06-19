import { describe, expect, it } from "vitest";

import { deriveSharedCookieDomain, resolveAuthCookieDomain } from "./cookie-domain.js";

describe("deriveSharedCookieDomain", () => {
  it("returns undefined when app and API share the same host", () => {
    expect(
      deriveSharedCookieDomain("http://localhost:3000", "http://localhost:3000"),
    ).toBeUndefined();
  });

  it("returns undefined for localhost on different ports (host-only cookies suffice)", () => {
    expect(
      deriveSharedCookieDomain("http://localhost:3000", "http://localhost:3001"),
    ).toBeUndefined();
  });

  it("derives pipewatch.app for cloud staging subdomains", () => {
    expect(
      deriveSharedCookieDomain(
        "https://staging-cloud.pipewatch.app",
        "https://staging-api.pipewatch.app",
      ),
    ).toBe("pipewatch.app");
  });

  it("derives pipewatch.app for cloud production subdomains", () => {
    expect(
      deriveSharedCookieDomain(
        "https://cloud.pipewatch.app",
        "https://api.pipewatch.app",
      ),
    ).toBe("pipewatch.app");
  });

  it("returns undefined when hosts have no shared registrable domain", () => {
    expect(
      deriveSharedCookieDomain(
        "https://app.example.com",
        "https://api.other.org",
      ),
    ).toBeUndefined();
  });
});

describe("resolveAuthCookieDomain", () => {
  it("prefers COOKIE_DOMAIN override", () => {
    expect(
      resolveAuthCookieDomain({
        COOKIE_DOMAIN: ".custom.example",
        APP_URL: "https://staging-cloud.pipewatch.app",
        PUBLIC_API_URL: "https://staging-api.pipewatch.app",
      }),
    ).toBe("custom.example");
  });
});

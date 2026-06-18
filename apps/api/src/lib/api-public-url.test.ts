import { describe, expect, it } from "vitest";

import { buildOAuthCallbackUrl, resolveApiPublicOrigin } from "./api-public-url.js";

function headers(map: Record<string, string>): { get(name: string): string | undefined } {
  return {
    get(name: string) {
      return map[name.toLowerCase()];
    },
  };
}

describe("resolveApiPublicOrigin", () => {
  it("prefers PUBLIC_API_URL when set", () => {
    const origin = resolveApiPublicOrigin(
      {
        PUBLIC_API_URL: "https://staging-api.pipewatch.app",
        NODE_ENV: "staging",
      },
      "http://internal:3001/auth/github",
      headers({}),
    );

    expect(origin).toBe("https://staging-api.pipewatch.app");
  });

  it("strips a trailing slash from PUBLIC_API_URL", () => {
    const origin = resolveApiPublicOrigin(
      {
        PUBLIC_API_URL: "https://api.pipewatch.app/",
        NODE_ENV: "production",
      },
      "http://internal/auth/github",
      headers({}),
    );

    expect(origin).toBe("https://api.pipewatch.app");
  });

  it("falls back to forwarded request headers in development", () => {
    const origin = resolveApiPublicOrigin(
      { NODE_ENV: "development" },
      "http://localhost:3001/auth/github",
      headers({
        "x-forwarded-proto": "https",
        "x-forwarded-host": "api.example.test",
      }),
    );

    expect(origin).toBe("https://api.example.test");
  });

  it("throws in staging when PUBLIC_API_URL is unset", () => {
    expect(() =>
      resolveApiPublicOrigin(
        { NODE_ENV: "staging" },
        "http://staging-api.pipewatch.app/auth/github",
        headers({ "x-forwarded-proto": "https" }),
      ),
    ).toThrow(/PUBLIC_API_URL is not configured/);
  });
});

describe("buildOAuthCallbackUrl", () => {
  it("builds the callback path from PUBLIC_API_URL", () => {
    expect(
      buildOAuthCallbackUrl(
        {
          PUBLIC_API_URL: "https://staging-api.pipewatch.app",
          NODE_ENV: "staging",
        },
        "http://ignored/auth/github",
        headers({}),
      ),
    ).toBe("https://staging-api.pipewatch.app/auth/github/callback");
  });
});

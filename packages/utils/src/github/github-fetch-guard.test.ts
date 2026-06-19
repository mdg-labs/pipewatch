import { describe, expect, it, vi } from "vitest";

import {
  assertGitHubAllowedUrl,
  createGuardedGitHubFetch,
  GitHubFetchGuardError,
} from "./github-fetch-guard.js";

describe("assertGitHubAllowedUrl", () => {
  it("allows api.github.com and github.com over HTTPS", () => {
    expect(() =>
      assertGitHubAllowedUrl("https://api.github.com/repos/acme/demo"),
    ).not.toThrow();
    expect(() =>
      assertGitHubAllowedUrl("https://github.com/login/oauth/access_token"),
    ).not.toThrow();
  });

  it("rejects disallowed hosts", () => {
    expect(() => assertGitHubAllowedUrl("https://evil.com/pwn")).toThrow(
      GitHubFetchGuardError,
    );
    expect(() => assertGitHubAllowedUrl("https://evil.com/pwn")).toThrow(
      /host not allowed: evil\.com/,
    );
  });

  it("rejects non-HTTPS schemes", () => {
    expect(() =>
      assertGitHubAllowedUrl("http://api.github.com/repos/acme/demo"),
    ).toThrow(/must use HTTPS/);
  });
});

describe("createGuardedGitHubFetch", () => {
  it("rejects disallowed hosts before calling fetch", async () => {
    const fetchImpl = vi.fn();

    const guardedFetch = createGuardedGitHubFetch(fetchImpl);

    await expect(
      guardedFetch("https://metadata.google.internal/computeMetadata/v1/"),
    ).rejects.toThrow(GitHubFetchGuardError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects redirect chains to non-allowlisted hosts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.com/steal" },
      }),
    );

    const guardedFetch = createGuardedGitHubFetch(fetchImpl);

    await expect(
      guardedFetch("https://api.github.com/repos/acme/demo"),
    ).rejects.toThrow(/host not allowed: evil\.com/);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows redirects that stay on the allowlist", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://api.github.com/repos/acme/demo/actions/runs",
          },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const guardedFetch = createGuardedGitHubFetch(fetchImpl);
    const response = await guardedFetch(
      "https://api.github.com/repos/acme/demo",
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

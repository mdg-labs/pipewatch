import { describe, expect, it } from "vitest";

import { selectPrimaryVerifiedGitHubEmail } from "./oauth.js";

describe("selectPrimaryVerifiedGitHubEmail", () => {
  it("returns primary verified email and skips noreply addresses", () => {
    const email = selectPrimaryVerifiedGitHubEmail([
      {
        email: "253028270+user@users.noreply.github.com",
        primary: true,
        verified: true,
      },
      {
        email: "real.user@example.com",
        primary: true,
        verified: true,
      },
    ]);

    expect(email).toBe("real.user@example.com");
  });

  it("returns null when only noreply primary verified email exists", () => {
    const email = selectPrimaryVerifiedGitHubEmail([
      {
        email: "253028270+user@users.noreply.github.com",
        primary: true,
        verified: true,
      },
    ]);

    expect(email).toBeNull();
  });

  it("returns null when primary email is unverified", () => {
    const email = selectPrimaryVerifiedGitHubEmail([
      {
        email: "pending@example.com",
        primary: true,
        verified: false,
      },
    ]);

    expect(email).toBeNull();
  });
});

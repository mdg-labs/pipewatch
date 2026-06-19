import { describe, expect, it } from "vitest";

import { buildGitHubAppInstallUrl, buildGitHubInstallCallbackUrl } from "./github";

describe("buildGitHubAppInstallUrl", () => {
  it("builds the GitHub App install URL from a slug", () => {
    expect(buildGitHubAppInstallUrl("pipewatch")).toBe(
      "https://github.com/apps/pipewatch/installations/new",
    );
  });

  it("trims whitespace from the slug", () => {
    expect(buildGitHubAppInstallUrl("  my-app  ")).toBe(
      "https://github.com/apps/my-app/installations/new",
    );
  });

  it("returns null when slug is missing or blank", () => {
    expect(buildGitHubAppInstallUrl()).toBeNull();
    expect(buildGitHubAppInstallUrl("")).toBeNull();
    expect(buildGitHubAppInstallUrl("   ")).toBeNull();
    expect(buildGitHubAppInstallUrl(null)).toBeNull();
  });
});

describe("buildGitHubInstallCallbackUrl", () => {
  it("builds the API install callback URL", () => {
    expect(buildGitHubInstallCallbackUrl("https://api.example.com/", "12345")).toBe(
      "https://api.example.com/onboarding/github-callback?installation_id=12345",
    );
  });
});

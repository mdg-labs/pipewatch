import { describe, expect, it } from "vitest";

import { incrementSemver } from "./ci/probe-version.mjs";
import {
  deriveRequiredConsumers,
  findAffectedSharedLibs,
  formatFailureMessage,
  isIgnoredPath,
  parsePrePushLine,
} from "./lib/package-version-policy.mjs";
import { parseAssignmentTokens, parseBumpChoice, parseCliArgs } from "./bump-package-versions.mjs";

describe("findAffectedSharedLibs", () => {
  it("detects packages/types source changes", () => {
    expect(findAffectedSharedLibs(["packages/types/src/pipeline-run.ts"])).toEqual([
      "packages/types",
    ]);
  });

  it("ignores markdown and spec-only edits under shared libs", () => {
    expect(findAffectedSharedLibs(["packages/ui/README.md", "packages/ui/src/foo.spec.ts"])).toEqual(
      [],
    );
  });

  it("merges consumers for multiple shared libs", () => {
    expect(
      findAffectedSharedLibs([
        "packages/types/src/index.ts",
        "packages/ui/src/Button.tsx",
      ]),
    ).toEqual(["packages/types", "packages/ui"]);
  });
});

describe("deriveRequiredConsumers", () => {
  it("maps packages/config to all deployables", () => {
    const consumers = deriveRequiredConsumers(["packages/config"]);
    expect(consumers).toContain("apps/api");
    expect(consumers).toContain("apps/worker");
    expect(consumers).toContain("apps/web");
    expect(consumers).toContain("apps/marketing");
    expect(consumers).toContain("apps/admin");
  });

  it("maps packages/db-admin to admin only", () => {
    expect(deriveRequiredConsumers(["packages/db-admin"])).toEqual(["apps/admin"]);
  });

  it("maps packages/github-app-auth to api, worker, admin", () => {
    expect(deriveRequiredConsumers(["packages/github-app-auth"])).toEqual([
      "apps/admin",
      "apps/api",
      "apps/worker",
    ]);
  });
});

describe("isIgnoredPath", () => {
  it("ignores package.json under packages", () => {
    expect(isIgnoredPath("packages/types/package.json")).toBe(true);
  });

  it("does not ignore deployable source files", () => {
    expect(isIgnoredPath("apps/web/src/app/page.tsx")).toBe(false);
  });

  it("does not ignore i18n locale JSON under apps/web", () => {
    expect(isIgnoredPath("apps/web/src/i18n/locales/en.json")).toBe(false);
  });

  it("does not ignore locale JSON under apps/marketing", () => {
    expect(isIgnoredPath("apps/marketing/src/i18n/locales/en.json")).toBe(false);
  });
});

describe("formatFailureMessage", () => {
  it("points operators to pnpm bump:versions", () => {
    const message = formatFailureMessage("origin/staging", [
      {
        dir: "apps/web",
        name: "@pipewatch/web",
        reasons: ["direct"],
        currentVersion: "0.1.0",
        remoteVersion: "0.1.0",
        sampleFiles: ["apps/web/src/app/page.tsx"],
      },
    ]);

    expect(message).toContain("check-push-version-bumps: FAIL");
    expect(message).toContain("pnpm bump:versions");
    expect(message).toContain("@pipewatch/web");
    expect(message).toContain("apps/web/src/app/page.tsx");
  });
});

describe("parsePrePushLine", () => {
  it("parses pre-push stdin format", () => {
    expect(
      parsePrePushLine(
        "refs/heads/staging abc123 refs/heads/staging def456",
      ),
    ).toEqual({
      localRef: "refs/heads/staging",
      localSha: "abc123",
      remoteRef: "refs/heads/staging",
      remoteSha: "def456",
    });
  });
});

describe("parseCliArgs", () => {
  it("parses dry-run and base", () => {
    expect(parseCliArgs(["--dry-run", "--base", "origin/staging"])).toEqual({
      dryRun: true,
      force: false,
      baseRef: "origin/staging",
      assignments: [],
    });
  });

  it("parses --force", () => {
    expect(parseCliArgs(["--force", "--", "patch"])).toEqual({
      dryRun: false,
      force: true,
      assignments: [
        { shortName: "api", level: "patch" },
        { shortName: "worker", level: "patch" },
        { shortName: "web", level: "patch" },
        { shortName: "marketing", level: "patch" },
        { shortName: "admin", level: "patch" },
      ],
    });
  });

  it("parses non-interactive assignments after --", () => {
    expect(parseCliArgs(["--", "web", "patch", "api", "minor"])).toEqual({
      dryRun: false,
      force: false,
      assignments: [
        { shortName: "web", level: "patch" },
        { shortName: "api", level: "minor" },
      ],
    });
  });
});

describe("parseAssignmentTokens", () => {
  it("expands a single level to all deployables", () => {
    expect(parseAssignmentTokens(["minor"])).toEqual([
      { shortName: "api", level: "minor" },
      { shortName: "worker", level: "minor" },
      { shortName: "web", level: "minor" },
      { shortName: "marketing", level: "minor" },
      { shortName: "admin", level: "minor" },
    ]);
  });

  it("parses per-package pairs", () => {
    expect(parseAssignmentTokens(["web", "patch", "admin", "major"])).toEqual([
      { shortName: "web", level: "patch" },
      { shortName: "admin", level: "major" },
    ]);
  });
});

describe("parseBumpChoice", () => {
  it("defaults empty input to patch", () => {
    expect(parseBumpChoice("")).toBe("patch");
  });

  it("distinguishes major M from minor m", () => {
    expect(parseBumpChoice("M")).toBe("major");
    expect(parseBumpChoice("m")).toBe("minor");
  });
});

describe("incrementSemver", () => {
  it("bumps patch minor and major", () => {
    expect(incrementSemver("1.2.3", "patch")).toBe("1.2.4");
    expect(incrementSemver("1.2.3", "minor")).toBe("1.3.0");
    expect(incrementSemver("1.2.3", "major")).toBe("2.0.0");
  });
});

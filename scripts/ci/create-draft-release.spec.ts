import { describe, expect, it, vi } from "vitest";

import {
  API_DIR,
  WEB_DIR,
  buildReleaseNotesBody,
  buildReleaseTitle,
  createDraftRelease,
  nextReleaseTagName,
  parseDeployFlag,
  readPackageVersion,
  shouldSkipDraftRelease,
} from "./create-draft-release.mjs";

describe("create-draft-release", () => {
  it("parseDeployFlag accepts only true", () => {
    expect(parseDeployFlag("true")).toBe(true);
    expect(parseDeployFlag("false")).toBe(false);
    expect(parseDeployFlag(undefined)).toBe(false);
  });

  it("shouldSkipDraftRelease when neither surface deployed", () => {
    expect(shouldSkipDraftRelease(false, false)).toBe(true);
    expect(shouldSkipDraftRelease(true, false)).toBe(false);
    expect(shouldSkipDraftRelease(false, true)).toBe(false);
  });

  it("buildReleaseTitle uses PipeWatch prefix and deployed surfaces only", () => {
    expect(
      buildReleaseTitle({
        deployApi: true,
        deployWeb: true,
        apiVersion: "1.2.3",
        webVersion: "4.5.6",
      }),
    ).toBe("PipeWatch API 1.2.3 · Web 4.5.6");

    expect(
      buildReleaseTitle({
        deployApi: true,
        deployWeb: false,
        apiVersion: "0.0.1",
        webVersion: "9.9.9",
      }),
    ).toBe("PipeWatch API 0.0.1");
  });

  it("buildReleaseNotesBody falls back to package title when log empty", () => {
    expect(buildReleaseNotesBody(null, "", "PipeWatch API 1.0.0")).toBe(
      "Packages: PipeWatch API 1.0.0",
    );
    expect(buildReleaseNotesBody("release-2026-01-01", "- feat: x (abc1234)", "t")).toContain(
      "## Changes since release-2026-01-01",
    );
  });

  it("nextReleaseTagName deduplicates same-day tags", () => {
    const existing = new Set(["release-2026-06-27"]);
    expect(nextReleaseTagName("2026-06-27", (tag) => existing.has(tag))).toBe(
      "release-2026-06-27-2",
    );
    expect(nextReleaseTagName("2026-06-28", (tag) => existing.has(tag))).toBe(
      "release-2026-06-28",
    );
  });

  it("reads api and web package versions from apps/*", () => {
    expect(readPackageVersion(API_DIR)).toMatch(/^\d+\.\d+\.\d+/);
    expect(readPackageVersion(WEB_DIR)).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("createDraftRelease skips without git/gh side effects", () => {
    const log = vi.fn();
    const result = createDraftRelease({
      deployApi: false,
      deployWeb: false,
      log,
    });
    expect(result.skipped).toBe(true);
    expect(log).toHaveBeenCalledWith(
      "Neither api nor web deployed — skipping draft release",
    );
  });

  it("createDraftRelease builds tag and release when api deployed", () => {
    const execTag = vi.fn();
    const execPushTag = vi.fn();
    const execGhRelease = vi.fn();
    const log = vi.fn();

    const result = createDraftRelease({
      deployApi: true,
      deployWeb: false,
      date: new Date("2026-06-27T12:00:00.000Z"),
      tagExists: () => false,
      findLastTag: () => "release-2026-06-01",
      gitLog: () => "- feat(ci): smoke scripts (deadbeef)",
      execTag,
      execPushTag,
      execGhRelease,
      log,
    });

    expect(result.skipped).toBe(false);
    expect(result.tag).toBe("release-2026-06-27");
    expect(result.title).toMatch(/^PipeWatch API /);
    expect(execTag).toHaveBeenCalledOnce();
    expect(execPushTag).toHaveBeenCalledWith("release-2026-06-27");
    expect(execGhRelease).toHaveBeenCalledOnce();
  });
});

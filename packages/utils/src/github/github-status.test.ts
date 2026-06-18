import { describe, expect, it, vi } from "vitest";

import {
  isKnownGitHubStatus,
  mapGitHubStatus,
} from "./github-status.js";

describe("mapGitHubStatus", () => {
  it("maps known GitHub status strings", () => {
    expect(mapGitHubStatus("queued")).toBe("queued");
    expect(mapGitHubStatus("waiting")).toBe("queued");
    expect(mapGitHubStatus("requested")).toBe("queued");
    expect(mapGitHubStatus("pending")).toBe("queued");
    expect(mapGitHubStatus("in_progress")).toBe("in_progress");
    expect(mapGitHubStatus("completed")).toBe("completed");
  });

  it("maps unknown statuses to in_progress, not completed", () => {
    expect(mapGitHubStatus("mystery")).toBe("in_progress");
    expect(mapGitHubStatus("")).toBe("in_progress");
    expect(mapGitHubStatus("success")).toBe("in_progress");
  });

  it("invokes onUnknown for unrecognized status strings", () => {
    const onUnknown = vi.fn();

    expect(mapGitHubStatus("mystery", { onUnknown })).toBe("in_progress");
    expect(onUnknown).toHaveBeenCalledOnce();
    expect(onUnknown).toHaveBeenCalledWith("mystery");
  });

  it("does not invoke onUnknown for known statuses", () => {
    const onUnknown = vi.fn();

    mapGitHubStatus("completed", { onUnknown });
    expect(onUnknown).not.toHaveBeenCalled();
  });
});

describe("isKnownGitHubStatus", () => {
  it("returns true for documented GitHub Actions statuses", () => {
    expect(isKnownGitHubStatus("queued")).toBe(true);
    expect(isKnownGitHubStatus("waiting")).toBe(true);
    expect(isKnownGitHubStatus("in_progress")).toBe(true);
    expect(isKnownGitHubStatus("completed")).toBe(true);
  });

  it("returns false for unknown values", () => {
    expect(isKnownGitHubStatus("mystery")).toBe(false);
    expect(isKnownGitHubStatus("")).toBe(false);
  });
});

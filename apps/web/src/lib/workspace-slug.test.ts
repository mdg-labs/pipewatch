import { describe, expect, it } from "vitest";

import { isValidWorkspaceSlug } from "./workspace-slug";

describe("isValidWorkspaceSlug", () => {
  it("accepts lowercase alphanumeric slugs with hyphens", () => {
    expect(isValidWorkspaceSlug("my-workspace")).toBe(true);
    expect(isValidWorkspaceSlug("acme")).toBe(true);
    expect(isValidWorkspaceSlug("a1-b2")).toBe(true);
  });

  it("rejects empty and whitespace-only slugs", () => {
    expect(isValidWorkspaceSlug("")).toBe(false);
    expect(isValidWorkspaceSlug("   ")).toBe(false);
  });

  it("rejects leading or trailing hyphens", () => {
    expect(isValidWorkspaceSlug("-bad")).toBe(false);
    expect(isValidWorkspaceSlug("bad-")).toBe(false);
  });

  it("rejects uppercase and invalid characters", () => {
    expect(isValidWorkspaceSlug("My-Workspace")).toBe(false);
    expect(isValidWorkspaceSlug("my_workspace")).toBe(false);
    expect(isValidWorkspaceSlug("my workspace")).toBe(false);
  });

  it("rejects slugs longer than 64 characters", () => {
    expect(isValidWorkspaceSlug("a".repeat(65))).toBe(false);
    expect(isValidWorkspaceSlug("a".repeat(64))).toBe(true);
  });
});

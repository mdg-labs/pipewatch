import { describe, expect, it } from "vitest";

import {
  buildPageRange,
  filtersToSearchParams,
  isTypedConfirmMatch,
  parseFiltersFromSearchParams,
} from "./index.js";

describe("pagination helpers", () => {
  it("builds page ranges with ellipses", () => {
    expect(buildPageRange(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });
});

describe("filter bar URL sync", () => {
  const fields = [
    { key: "status", defaultValue: "all" },
    { key: "branch" },
    { key: "tags", multi: true },
  ] as const;

  it("parses filters from URL search params", () => {
    const params = new URLSearchParams("status=failing&branch=main&tags=ci&tags=release");

    expect(parseFiltersFromSearchParams(params, [...fields])).toEqual({
      status: "failing",
      branch: "main",
      tags: ["ci", "release"],
    });
  });

  it("omits default values when serializing filters", () => {
    const params = filtersToSearchParams(
      {
        status: "all",
        branch: "main",
      },
      [...fields],
    );

    expect(params.toString()).toBe("branch=main");
  });

  it("round-trips non-default filters", () => {
    const initial = new URLSearchParams("status=running&branch=dev");
    const parsed = parseFiltersFromSearchParams(initial, [...fields]);
    const serialized = filtersToSearchParams(parsed, [...fields]);

    expect(serialized.toString()).toBe("status=running&branch=dev");
  });
});

describe("typed confirm gate", () => {
  it("requires an exact phrase match", () => {
    expect(isTypedConfirmMatch("DELETE", "DELETE")).toBe(true);
    expect(isTypedConfirmMatch("delete", "DELETE")).toBe(false);
    expect(isTypedConfirmMatch("my-workspace", "my-workspace")).toBe(true);
    expect(isTypedConfirmMatch("my-workspace ", "my-workspace")).toBe(false);
  });
});

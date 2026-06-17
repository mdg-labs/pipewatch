import { describe, expect, it } from "vitest";

import { API_KEY_PREFIX, isApiKeyToken, parseBearerToken, roleMeetsMinimum } from "./workspace-context.js";

describe("parseBearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(parseBearerToken("Bearer eyJhbGciOiJIUzI1NiJ9.test")).toBe(
      "eyJhbGciOiJIUzI1NiJ9.test",
    );
  });

  it("returns undefined for missing or malformed headers", () => {
    expect(parseBearerToken(undefined)).toBeUndefined();
    expect(parseBearerToken("Basic abc")).toBeUndefined();
  });
});

describe("isApiKeyToken", () => {
  it("detects pw_ API key tokens", () => {
    expect(isApiKeyToken(`${API_KEY_PREFIX}live_abc123`)).toBe(true);
    expect(isApiKeyToken("eyJhbGciOiJIUzI1NiJ9.test")).toBe(false);
  });
});

describe("roleMeetsMinimum", () => {
  it("allows higher roles to satisfy admin and owner gates", () => {
    expect(roleMeetsMinimum("owner", "admin")).toBe(true);
    expect(roleMeetsMinimum("owner", "owner")).toBe(true);
    expect(roleMeetsMinimum("admin", "admin")).toBe(true);
  });

  it("rejects roles below the minimum", () => {
    expect(roleMeetsMinimum("member", "admin")).toBe(false);
    expect(roleMeetsMinimum("admin", "owner")).toBe(false);
    expect(roleMeetsMinimum("member", "owner")).toBe(false);
  });
});

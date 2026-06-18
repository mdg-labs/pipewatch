import { describe, expect, it } from "vitest";

import {
  buildGitHubOAuthUrl,
  isSafeNextPath,
  parseNextParam,
} from "./auth-redirect";

describe("auth-redirect", () => {
  describe("isSafeNextPath", () => {
    it("accepts relative paths", () => {
      expect(isSafeNextPath("/workspaces/acme")).toBe(true);
      expect(isSafeNextPath("/invite/token")).toBe(true);
    });

    it("rejects open redirects", () => {
      expect(isSafeNextPath("//evil.example")).toBe(false);
      expect(isSafeNextPath("https://evil.example")).toBe(false);
    });
  });

  describe("parseNextParam", () => {
    it("returns undefined for missing or unsafe values", () => {
      expect(parseNextParam(undefined)).toBeUndefined();
      expect(parseNextParam(["/a", "/b"])).toBeUndefined();
      expect(parseNextParam("//evil")).toBeUndefined();
    });

    it("returns safe paths", () => {
      expect(parseNextParam("/workspaces/acme")).toBe("/workspaces/acme");
    });
  });

  describe("buildGitHubOAuthUrl", () => {
    it("builds OAuth URL without next when absent", () => {
      expect(buildGitHubOAuthUrl("https://api.example.com")).toBe(
        "https://api.example.com/auth/github",
      );
    });

    it("forwards safe next param", () => {
      expect(
        buildGitHubOAuthUrl("https://api.example.com/", "/invite/abc"),
      ).toBe("https://api.example.com/auth/github?next=%2Finvite%2Fabc");
    });

    it("omits unsafe next param", () => {
      expect(
        buildGitHubOAuthUrl("https://api.example.com", "//evil.example"),
      ).toBe("https://api.example.com/auth/github");
    });
  });
});

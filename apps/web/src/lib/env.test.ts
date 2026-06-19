import { afterEach, describe, expect, it, vi } from "vitest";

describe("publicApiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads NEXT_PUBLIC_API_URL when set at build time", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://staging-api.pipewatch.app");
    const { publicApiUrl } = await import("./env");
    expect(publicApiUrl).toBe("https://staging-api.pipewatch.app");
  });

  it("is empty when NEXT_PUBLIC_API_URL is missing from the client bundle", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { publicApiUrl } = await import("./env");
    expect(publicApiUrl).toBe("");
  });
});

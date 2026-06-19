import { describe, expect, it } from "vitest";

import { fetchAppConfig } from "./public-config";

describe("fetchAppConfig", () => {
  it("returns githubAppSlug from the public API", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ github_app_slug: "acme-pipewatch" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(
      fetchAppConfig({
        apiUrl: "https://api.example.com",
        fetchImpl,
      }),
    ).resolves.toEqual({ githubAppSlug: "acme-pipewatch" });
  });

  it("returns null when slug is missing or blank", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ github_app_slug: null }), { status: 200 });

    await expect(
      fetchAppConfig({
        apiUrl: "https://api.example.com",
        fetchImpl,
      }),
    ).resolves.toEqual({ githubAppSlug: null });
  });

  it("returns null when apiUrl is unset", async () => {
    await expect(fetchAppConfig({ apiUrl: "" })).resolves.toEqual({
      githubAppSlug: null,
    });
  });
});

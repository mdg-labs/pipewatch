import { describe, expect, it, vi } from "vitest";

import { fetchAppSession } from "./server-session";

vi.mock("./env", () => ({
  publicApiUrl: "https://api.example.test",
}));

describe("fetchAppSession", () => {
  it("returns profile and workspaces from the API", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/users/me")) {
        return new Response(
          JSON.stringify({
            name: "Jane Doe",
            email: "jane@example.com",
            avatar_url: "https://avatars.example.test/jane",
            github_login: "janedoe",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.endsWith("/api/v1/workspaces")) {
        return new Response(
          JSON.stringify([
            {
              id: "ws_real_1",
              name: "MDG Labs",
              slug: "mdg-labs",
              plan: "pro",
              default_retention_days: 30,
              created_at: "2026-01-01T00:00:00.000Z",
              role: "owner",
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(null, { status: 404 });
    });

    const session = await fetchAppSession({
      accessToken: "test-token",
      fetchImpl,
    });

    expect(session.user).toEqual({
      name: "Jane Doe",
      githubLogin: "janedoe",
      avatarUrl: "https://avatars.example.test/jane",
    });
    expect(session.workspaces[0]?.id).toBe("ws_real_1");
    expect(session.activeWorkspaceSlug).toBe("mdg-labs");
    expect(session.role).toBe("owner");
    expect(session.authenticated).toBe(true);
  });

  it("marks authenticated even when the user has no workspaces", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/users/me")) {
        return new Response(
          JSON.stringify({
            name: "New User",
            email: "new@example.com",
            avatar_url: null,
            github_login: "newuser",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.endsWith("/api/v1/workspaces")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(null, { status: 404 });
    });

    const session = await fetchAppSession({ accessToken: "test-token", fetchImpl });

    expect(session.authenticated).toBe(true);
    expect(session.workspaces).toEqual([]);
    expect(session.activeWorkspaceSlug).toBe("");
  });

  it("returns an unauthenticated session when the access token is rejected", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 401 }),
    );

    const session = await fetchAppSession({ accessToken: "expired", fetchImpl });

    expect(session.authenticated).toBe(false);
    expect(session.workspaces).toEqual([]);
  });

  it("returns empty session when access token is missing", async () => {
    const session = await fetchAppSession({ accessToken: null });
    expect(session.workspaces).toEqual([]);
    expect(session.user.githubLogin).toBe("");
    expect(session.authenticated).toBe(false);
  });
});

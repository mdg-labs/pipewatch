/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAccessToken, setAccessToken } from "./auth";
import { ApiClientError, createApiClient } from "./api-client";

const API_URL = "https://api.example.test";

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${header}.${body}.signature`;
}

describe("createApiClient", () => {
  afterEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  it("sends Authorization Bearer with the in-memory access token", async () => {
    const token = makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 3600 });
    setAccessToken(token);

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });
    await client.get("/users/me");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("Authorization")).toBe(`Bearer ${token}`);
    expect(init.credentials).toBe("include");
  });

  it("refreshes once on 401 and retries the original request", async () => {
    const staleToken = makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) - 60 });
    const freshToken = makeJwt({
      sub: "user_1",
      workspaceId: "ws_1",
      role: "owner",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setAccessToken(staleToken);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: {
            "set-cookie": `pw_access=${freshToken}; HttpOnly; Path=/; SameSite=Lax`,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ github_login: "janedoe" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });
    const profile = await client.get<{ github_login: string }>("/users/me");

    expect(profile.github_login).toBe("janedoe");
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(refreshUrl).toBe(`${API_URL}/auth/refresh`);
    expect(refreshInit.method).toBe("POST");
    expect(refreshInit.credentials).toBe("include");

    const [, retryInit] = fetchImpl.mock.calls[2] as [string, RequestInit];
    expect((retryInit.headers as Headers).get("Authorization")).toBe(`Bearer ${freshToken}`);
  });

  it("does not retry more than once when refresh succeeds but the request stays 401", async () => {
    const token = makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 3600 });
    const refreshedToken = makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 7200 });
    setAccessToken(token);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: {
            "set-cookie": `pw_access=${refreshedToken}; HttpOnly; Path=/`,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });

    await expect(client.get("/users/me")).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("throws without retrying when refresh fails", async () => {
    setAccessToken(makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 3600 }));

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });

    await expect(client.get("/users/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("prefixes workspace-scoped paths under /api/v1/workspaces/:id", async () => {
    setAccessToken(makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 3600 }));

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });
    await client.workspace("ws_abc").get("/integrations");

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(`${API_URL}/api/v1/workspaces/ws_abc/integrations`);
  });

  it("does not append a trailing slash for workspace root scoped paths", async () => {
    setAccessToken(makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 3600 }));

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "ws_abc", name: "Acme" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });
    await client.workspace("ws_abc").get("");

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(`${API_URL}/api/v1/workspaces/ws_abc`);
    expect(url).not.toMatch(/\/$/);
  });

  it("post with body and access token sends Authorization and Content-Type", async () => {
    const token = makeJwt({ sub: "user_1", exp: Math.floor(Date.now() / 1000) + 3600 });
    setAccessToken(token);

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "ws_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });
    await client.post("/workspaces", { name: "My Workspace" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("Authorization")).toBe(`Bearer ${token}`);
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "My Workspace" }));
  });

  it("patch with body and no token still sends Content-Type application/json", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "Updated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({ apiUrl: API_URL, fetchImpl });
    await client.patch("/workspaces/ws_1", { name: "Updated" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("Authorization")).toBeNull();
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Updated" }));
  });
});

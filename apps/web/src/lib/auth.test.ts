/** @vitest-environment node */

import type { AccessTokenClaims, WorkspaceListItem } from "@pipewatch/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAccessToken, refreshAccessToken, resolveWorkspaceId } from "./auth";

const API_URL = "https://api.example.test";

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${header}.${body}.signature`;
}

function mockWorkspace(id: string, slug: string): WorkspaceListItem {
  return {
    id,
    slug,
    name: slug,
    role: "owner",
    plan: "free",
    default_retention_days: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("resolveWorkspaceId", () => {
  it("resolves from the workspace list by slug", () => {
    const workspaces = [mockWorkspace("ws_1", "mdg-labs"), mockWorkspace("ws_2", "acme")];
    expect(resolveWorkspaceId("acme", workspaces)).toBe("ws_2");
  });

  it("falls back to JWT claims when the slug is not in the list", () => {
    const claims: AccessTokenClaims = {
      sub: "user_1",
      workspaceId: "ws_from_claims",
      iat: 0,
      exp: 0,
    };
    expect(resolveWorkspaceId("missing", [], claims)).toBe("ws_from_claims");
  });

  it("returns null when neither list nor claims resolve the workspace", () => {
    expect(resolveWorkspaceId("missing", [], null)).toBeNull();
    expect(resolveWorkspaceId(null, [])).toBeNull();
  });

  it("prefers the workspace list over claims", () => {
    const claims: AccessTokenClaims = {
      sub: "user_1",
      workspaceId: "ws_from_claims",
      iat: 0,
      exp: 0,
    };
    const workspaces = [mockWorkspace("ws_list", "mdg-labs")];
    expect(resolveWorkspaceId("mdg-labs", workspaces, claims)).toBe("ws_list");
  });
});

describe("refreshAccessToken", () => {
  afterEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  it("de-duplicates concurrent refreshes into a single network request", async () => {
    const freshToken = makeJwt({
      sub: "user_1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = refreshAccessToken({ apiUrl: API_URL, fetchImpl });
    const second = refreshAccessToken({ apiUrl: API_URL, fetchImpl });

    resolveFetch?.(
      new Response(null, {
        status: 204,
        headers: { "set-cookie": `pw_access=${freshToken}; HttpOnly; Path=/` },
      }),
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
  });

  it("returns ok:false when the refresh request is rejected", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 401 }));
    const result = await refreshAccessToken({ apiUrl: API_URL, fetchImpl });
    expect(result.ok).toBe(false);
  });
});

/** @vitest-environment happy-dom */

import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceListItem } from "@pipewatch/types";

import type { WorkspaceScopedClient } from "@/lib/api-client";

import { ApiAuthProvider, useApi } from "./use-api";

const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";

function mockWorkspaceListItem(
  id: string,
  slug: string,
  name: string,
): WorkspaceListItem {
  return {
    id,
    slug,
    name,
    role: "owner",
    plan: "free",
    default_retention_days: 30,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

const workspaceIdState = vi.hoisted(() => ({
  value: "22222222-2222-4222-8222-222222222222" as string | null,
}));

const mockRouter = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspaces/mdg-labs",
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/env", () => ({
  publicApiUrl: "https://api.example.test",
}));

vi.mock("@/lib/auth", () => ({
  getAccessTokenClaims: () => null,
  resolveWorkspaceId: () => workspaceIdState.value,
  setAccessToken: vi.fn(),
}));

describe("useApi", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    workspaceIdState.value = WORKSPACE_ID;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("keeps workspace client reference stable across re-renders with same workspaceId", async () => {
    const workspaceRefs: Array<WorkspaceScopedClient | null> = [];

    function Probe() {
      const { workspace } = useApi();
      const [, bump] = useState(0);

      workspaceRefs.push(workspace);

      return createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            bump((count) => count + 1);
          },
        },
        "rerender",
      );
    }

    await act(async () => {
      root.render(
        createElement(ApiAuthProvider, {
          workspaces: [mockWorkspaceListItem(WORKSPACE_ID, "mdg-labs", "MDG Labs")],
          children: createElement(Probe),
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(workspaceRefs.length).toBeGreaterThanOrEqual(2);
    expect(workspaceRefs[0]).not.toBeNull();
    expect(workspaceRefs[0]).toBe(workspaceRefs[1]);
  });

  it("returns a new workspace client when workspaceId changes", async () => {
    const workspaceRefs: Array<WorkspaceScopedClient | null> = [];

    function Probe() {
      const { workspace } = useApi();

      useEffect(() => {
        workspaceRefs.push(workspace);
      }, [workspace]);

      return null;
    }

    await act(async () => {
      root.render(
        createElement(ApiAuthProvider, {
          workspaces: [mockWorkspaceListItem(WORKSPACE_ID, "mdg-labs", "MDG Labs")],
          children: createElement(Probe),
        }),
      );
      await Promise.resolve();
    });

    workspaceIdState.value = OTHER_WORKSPACE_ID;

    await act(async () => {
      root.render(
        createElement(ApiAuthProvider, {
          workspaces: [mockWorkspaceListItem(OTHER_WORKSPACE_ID, "other", "Other")],
          children: createElement(Probe),
        }),
      );
      await Promise.resolve();
    });

    expect(workspaceRefs.length).toBeGreaterThanOrEqual(2);
    expect(workspaceRefs[0]).not.toBeNull();
    expect(workspaceRefs.at(-1)).not.toBeNull();
    expect(workspaceRefs[0]).not.toBe(workspaceRefs.at(-1));
  });
});

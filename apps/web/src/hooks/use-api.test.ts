/** @vitest-environment happy-dom */

import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceListItem } from "@pipewatch/types";

import type { WorkspaceScopedClient } from "@/lib/api-client";

import { ApiAuthProvider, useApi, type WorkspaceResolutionStatus } from "./use-api";

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
  replace: vi.fn(),
}));

const refreshAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspaces/mdg-labs",
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/env", () => ({
  publicApiUrl: "https://api.example.test",
}));

vi.mock("@/lib/auth", () => ({
  decodeAccessTokenClaims: () => null,
  resolveWorkspaceId: () => workspaceIdState.value,
  refreshAccessToken: refreshAccessTokenMock,
  setAccessToken: vi.fn(),
}));

describe("useApi", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    workspaceIdState.value = WORKSPACE_ID;
    refreshAccessTokenMock.mockReset();
    refreshAccessTokenMock.mockResolvedValue({ ok: true });
    mockRouter.refresh.mockClear();
    mockRouter.replace.mockClear();
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

  it("reports ready status and never recovers when the workspace resolves", async () => {
    const statuses: WorkspaceResolutionStatus[] = [];

    function Probe() {
      const { workspaceStatus } = useApi();
      statuses.push(workspaceStatus);
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

    expect(statuses.at(-1)).toBe("ready");
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it("recovers the session and refreshes the route when the workspace cannot be resolved", async () => {
    workspaceIdState.value = null;
    const statuses: WorkspaceResolutionStatus[] = [];

    function Probe() {
      const { workspaceStatus, workspace } = useApi();
      statuses.push(workspaceStatus);
      // No load error is surfaced while the session is still resolving.
      expect(workspace).toBeNull();
      return null;
    }

    await act(async () => {
      root.render(
        createElement(ApiAuthProvider, {
          workspaces: [],
          children: createElement(Probe),
        }),
      );
      await Promise.resolve();
    });

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(statuses).toContain("resolving");
    expect(statuses).not.toContain("unresolved");
  });

  it("marks the workspace unresolved when recovery fails", async () => {
    workspaceIdState.value = null;
    refreshAccessTokenMock.mockResolvedValue({ ok: false });
    const statuses: WorkspaceResolutionStatus[] = [];

    function Probe() {
      const { workspaceStatus } = useApi();
      statuses.push(workspaceStatus);
      return null;
    }

    await act(async () => {
      root.render(
        createElement(ApiAuthProvider, {
          workspaces: [],
          children: createElement(Probe),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("unresolved");
  });
});

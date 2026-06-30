/** @vitest-environment happy-dom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionRecoveryRedirect } from "./SessionRecoveryRedirect";

const mockRouter = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

const refreshAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/env", () => ({
  publicApiUrl: "https://api.example.test",
}));

vi.mock("@/lib/auth", () => ({
  refreshAccessToken: refreshAccessTokenMock,
}));

describe("SessionRecoveryRedirect", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    refreshAccessTokenMock.mockReset();
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

  it("re-runs the server render after a successful refresh", async () => {
    refreshAccessTokenMock.mockResolvedValue({ ok: true });

    await act(async () => {
      root.render(createElement(SessionRecoveryRedirect, { fallbackPath: "/" }));
      await Promise.resolve();
    });

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("redirects to sign-in with the fallback path when refresh fails", async () => {
    refreshAccessTokenMock.mockResolvedValue({ ok: false });

    await act(async () => {
      root.render(
        createElement(SessionRecoveryRedirect, { fallbackPath: "/onboarding" }),
      );
      await Promise.resolve();
    });

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith(
      "/sign-in?next=%2Fonboarding",
    );
  });
});

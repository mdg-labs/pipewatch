/** @vitest-environment happy-dom */

import type { SseDataEvent } from "@pipewatch/types";
import { act } from "react";
import { createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRepoSseClient } from "@/lib/sse-client";

import { extractRepoIdFromPath, useRepoStream } from "./use-repo-stream";

const API_URL = "https://api.example.test";
const WORKSPACE_ID = "ws_abc";
const REPO_ID = "repo_123";

type MockEventSourceInstance = {
  url: string;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
};

function createMockEventSourceFactory() {
  const instances: MockEventSourceInstance[] = [];

  const EventSourceFactory = vi.fn((url: string) => {
    const instance: MockEventSourceInstance = {
      url,
      onopen: null,
      onmessage: null,
      onerror: null,
      close: vi.fn(),
    };
    instances.push(instance);
    return instance as unknown as EventSource;
  }) as unknown as typeof EventSource;

  return { EventSourceFactory, instances };
}

describe("extractRepoIdFromPath", () => {
  it("returns repo id from repository routes", () => {
    expect(extractRepoIdFromPath("/workspaces/mdg-labs/repos/repo-1")).toBe("repo-1");
    expect(extractRepoIdFromPath("/workspaces/mdg-labs/repos/repo-1/runs/run-1")).toBe(
      "repo-1",
    );
    expect(extractRepoIdFromPath("/workspaces/mdg-labs/repos/repo-1/settings")).toBe("repo-1");
  });

  it("returns null outside repository routes", () => {
    expect(extractRepoIdFromPath("/workspaces/mdg-labs")).toBeNull();
    expect(extractRepoIdFromPath("/workspaces/mdg-labs/settings/members")).toBeNull();
  });
});

describe("createRepoSseClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fetches a one-time token and opens EventSource with ?token=", async () => {
    const { EventSourceFactory, instances } = createMockEventSourceFactory();
    const fetchToken = vi.fn().mockResolvedValue({ token: "sse-token-1", expiresIn: 60 });

    const client = createRepoSseClient({
      apiUrl: API_URL,
      workspaceId: WORKSPACE_ID,
      repoId: REPO_ID,
      fetchToken,
      eventSourceFactory: EventSourceFactory,
    });

    client.connect();
    await Promise.resolve();

    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(EventSourceFactory).toHaveBeenCalledWith(
      `${API_URL}/api/v1/workspaces/${WORKSPACE_ID}/repos/${REPO_ID}/stream?token=sse-token-1`,
    );
    expect(instances).toHaveLength(1);
    expect(client.getStatus()).toBe("reconnecting");

    act(() => {
      instances[0]?.onopen?.();
    });

    expect(client.getStatus()).toBe("connected");
  });

  it("dispatches run and job events to onEvent", async () => {
    const { EventSourceFactory, instances } = createMockEventSourceFactory();
    const onEvent = vi.fn<(event: SseDataEvent) => void>();
    const runEvent: SseDataEvent = {
      type: "run:created",
      data: {
        id: "run_1",
        pipelineName: "CI",
        status: "in_progress",
        conclusion: null,
        branch: "main",
        startedAt: "2026-06-17T10:00:00.000Z",
        durationMs: null,
      },
    };

    const client = createRepoSseClient({
      apiUrl: API_URL,
      workspaceId: WORKSPACE_ID,
      repoId: REPO_ID,
      fetchToken: vi.fn().mockResolvedValue({ token: "sse-token-1", expiresIn: 60 }),
      eventSourceFactory: EventSourceFactory,
      onEvent,
    });

    client.connect();
    await Promise.resolve();

    act(() => {
      instances[0]?.onmessage?.({ data: JSON.stringify(runEvent) } as MessageEvent<string>);
    });

    expect(onEvent).toHaveBeenCalledWith(runEvent);
  });

  it("reconnects with a fresh token after EventSource errors", async () => {
    const { EventSourceFactory, instances } = createMockEventSourceFactory();
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ token: "sse-token-1", expiresIn: 60 })
      .mockResolvedValueOnce({ token: "sse-token-2", expiresIn: 60 });

    const client = createRepoSseClient({
      apiUrl: API_URL,
      workspaceId: WORKSPACE_ID,
      repoId: REPO_ID,
      fetchToken,
      eventSourceFactory: EventSourceFactory,
    });

    client.connect();
    await Promise.resolve();

    act(() => {
      instances[0]?.onopen?.();
      instances[0]?.onerror?.();
    });

    expect(client.getStatus()).toBe("reconnecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(fetchToken).toHaveBeenCalledTimes(2);
    expect(instances).toHaveLength(2);
    expect(instances[1]?.url).toContain("token=sse-token-2");
  });

  it("disconnects and stays offline on cleanup", async () => {
    const { EventSourceFactory, instances } = createMockEventSourceFactory();

    const client = createRepoSseClient({
      apiUrl: API_URL,
      workspaceId: WORKSPACE_ID,
      repoId: REPO_ID,
      fetchToken: vi.fn().mockResolvedValue({ token: "sse-token-1", expiresIn: 60 }),
      eventSourceFactory: EventSourceFactory,
    });

    client.connect();
    await Promise.resolve();

    act(() => {
      instances[0]?.onopen?.();
    });

    client.disconnect();

    expect(instances[0]?.close).toHaveBeenCalled();
    expect(client.getStatus()).toBe("offline");

    act(() => {
      instances[0]?.onerror?.();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(instances).toHaveLength(1);
  });
});

const pathnameState = vi.hoisted(() => ({
  value: "/workspaces/mdg-labs/repos/repo-1",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

const apiState = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./use-api", () => ({
  useApi: () => ({
    api: {
      get: apiState.get,
    },
    workspaceId: WORKSPACE_ID,
    workspaceSlug: "mdg-labs",
    workspace: null,
    claims: null,
    workspaces: [],
  }),
}));

vi.mock("@/lib/env", () => ({
  publicApiUrl: "https://api.example.test",
}));

describe("useRepoStream", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    pathnameState.value = "/workspaces/mdg-labs/repos/repo-1";
    apiState.get.mockReset();
    apiState.get.mockResolvedValue({ token: "hook-token", expiresIn: 60 });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays offline when not on a repository route", async () => {
    pathnameState.value = "/workspaces/mdg-labs";
    const { EventSourceFactory } = createMockEventSourceFactory();
    vi.stubGlobal("EventSource", EventSourceFactory);

    let status: string | undefined;
    function Probe() {
      const result = useRepoStream();
      useEffect(() => {
        status = result.status;
      }, [result.status]);
      return null;
    }

    await act(async () => {
      root.render(createElement(Probe));
      await Promise.resolve();
    });

    expect(status).toBe("offline");
    expect(EventSourceFactory).not.toHaveBeenCalled();
  });

  it("reconnects when navigation changes the active repo", async () => {
    const { EventSourceFactory, instances } = createMockEventSourceFactory();
    vi.stubGlobal("EventSource", EventSourceFactory);

    function Probe() {
      useRepoStream();
      return null;
    }

    await act(async () => {
      root.render(createElement(Probe));
      await Promise.resolve();
    });

    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toContain("/repos/repo-1/stream");

    pathnameState.value = "/workspaces/mdg-labs/repos/repo-2";

    await act(async () => {
      root.render(createElement(Probe));
      await Promise.resolve();
    });

    expect(instances[0]?.close).toHaveBeenCalled();
    expect(instances).toHaveLength(2);
    expect(instances[1]?.url).toContain("/repos/repo-2/stream");
  });
});

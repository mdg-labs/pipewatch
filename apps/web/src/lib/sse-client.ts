import type { SseDataEvent } from "@pipewatch/types";

export type RepoSseConnectionStatus = "connected" | "reconnecting" | "offline";

export type SseTokenResponse = {
  token: string;
  expiresIn: number;
};

export type SseTokenFetcher = () => Promise<SseTokenResponse>;

export type RepoSseClientConfig = {
  apiUrl: string;
  workspaceId: string;
  repoId: string;
  fetchToken: SseTokenFetcher;
  eventSourceFactory?: typeof EventSource;
  onStatusChange?: (status: RepoSseConnectionStatus) => void;
  onEvent?: (event: SseDataEvent) => void;
};

export type RepoSseClient = {
  connect: () => void;
  disconnect: () => void;
  getStatus: () => RepoSseConnectionStatus;
};

const RECONNECT_DELAY_MS = 1_000;

function buildStreamUrl(
  apiUrl: string,
  workspaceId: string,
  repoId: string,
  token: string,
): string {
  const base = apiUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ token });
  return `${base}/api/v1/workspaces/${workspaceId}/repos/${repoId}/stream?${query.toString()}`;
}

function parseSseDataEvent(data: string): SseDataEvent | null {
  try {
    const parsed = JSON.parse(data) as { type?: string };
    if (
      parsed.type === "run:created" ||
      parsed.type === "run:updated" ||
      parsed.type === "run:completed" ||
      parsed.type === "job:updated"
    ) {
      return parsed as SseDataEvent;
    }
  } catch {
    // Ignore malformed SSE payloads.
  }

  return null;
}

/** Manage a repo-scoped SSE connection with one-time token auth (PRD §19). */
export function createRepoSseClient(config: RepoSseClientConfig): RepoSseClient {
  const EventSourceCtor = config.eventSourceFactory ?? EventSource;

  let status: RepoSseConnectionStatus = "offline";
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function setStatus(next: RepoSseConnectionStatus): void {
    if (status === next) {
      return;
    }

    status = next;
    config.onStatusChange?.(next);
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeEventSource(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function scheduleReconnect(): void {
    if (disposed) {
      return;
    }

    setStatus("reconnecting");
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      void openConnection();
    }, RECONNECT_DELAY_MS);
  }

  async function openConnection(): Promise<void> {
    if (disposed) {
      return;
    }

    clearReconnectTimer();
    closeEventSource();
    setStatus("reconnecting");

    try {
      const { token } = await config.fetchToken();
      if (disposed) {
        return;
      }

      const source = new EventSourceCtor(
        buildStreamUrl(config.apiUrl, config.workspaceId, config.repoId, token),
      );
      eventSource = source;

      source.onopen = () => {
        if (disposed) {
          return;
        }

        setStatus("connected");
      };

      source.onmessage = (event: MessageEvent<string>) => {
        if (disposed) {
          return;
        }

        const dataEvent = parseSseDataEvent(event.data);
        if (dataEvent) {
          config.onEvent?.(dataEvent);
        }
      };

      source.onerror = () => {
        if (disposed) {
          return;
        }

        closeEventSource();
        scheduleReconnect();
      };
    } catch {
      if (!disposed) {
        scheduleReconnect();
      }
    }
  }

  return {
    connect() {
      disposed = false;
      void openConnection();
    },
    disconnect() {
      disposed = true;
      clearReconnectTimer();
      closeEventSource();
      setStatus("offline");
    },
    getStatus() {
      return status;
    },
  };
}

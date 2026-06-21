import type { SseDataEvent } from "@pipewatch/types";

import type { LiveConnectionStatus } from "@/components/app-shell/LiveIndicator";

export type RepoSseConnectionStatus = LiveConnectionStatus;

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
  /** Grace period before downgrading the badge from connected after a blip. */
  connectedGraceMs?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
};

export type RepoSseClient = {
  connect: () => void;
  disconnect: () => void;
  getStatus: () => RepoSseConnectionStatus;
};

export const SSE_CONNECTED_GRACE_MS = 3_000;
export const SSE_RECONNECT_BASE_DELAY_MS = 1_000;
export const SSE_RECONNECT_MAX_DELAY_MS = 30_000;

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

function parseSsePayload(data: string): SseDataEvent | { type: "heartbeat" } | null {
  try {
    const parsed = JSON.parse(data) as { type?: string };
    if (parsed.type === "heartbeat") {
      return { type: "heartbeat" };
    }

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

/** Exponential backoff delay for reconnect attempts (1s, 2s, 4s, … capped). */
export function computeReconnectDelayMs(
  attempt: number,
  baseDelayMs = SSE_RECONNECT_BASE_DELAY_MS,
  maxDelayMs = SSE_RECONNECT_MAX_DELAY_MS,
): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(baseDelayMs * 2 ** exponent, maxDelayMs);
}

/** Manage a repo-scoped SSE connection with one-time token auth (PRD §19). */
export function createRepoSseClient(config: RepoSseClientConfig): RepoSseClient {
  const EventSourceCtor = config.eventSourceFactory ?? EventSource;
  const connectedGraceMs = config.connectedGraceMs ?? SSE_CONNECTED_GRACE_MS;
  const reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? SSE_RECONNECT_BASE_DELAY_MS;
  const reconnectMaxDelayMs = config.reconnectMaxDelayMs ?? SSE_RECONNECT_MAX_DELAY_MS;

  let status: RepoSseConnectionStatus = "offline";
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let downgradeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let hasConnected = false;
  let reconnectAttempt = 0;
  let lastHealthyAt = 0;

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

  function clearDowngradeTimer(): void {
    if (downgradeTimer) {
      clearTimeout(downgradeTimer);
      downgradeTimer = null;
    }
  }

  function closeEventSource(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function markHealthy(): void {
    lastHealthyAt = Date.now();
    reconnectAttempt = 0;
    clearDowngradeTimer();
    setStatus("connected");
  }

  function scheduleReconnect(): void {
    if (disposed) {
      return;
    }

    reconnectAttempt += 1;
    const delay = computeReconnectDelayMs(
      reconnectAttempt,
      reconnectBaseDelayMs,
      reconnectMaxDelayMs,
    );

    const downgradeStatus: RepoSseConnectionStatus = hasConnected ? "reconnecting" : "connecting";
    const timeSinceHealthy = Date.now() - lastHealthyAt;
    const remainingGrace =
      hasConnected && lastHealthyAt > 0
        ? Math.max(0, connectedGraceMs - timeSinceHealthy)
        : 0;

    clearDowngradeTimer();
    if (remainingGrace > 0) {
      downgradeTimer = setTimeout(() => {
        downgradeTimer = null;
        if (!disposed && status === "connected") {
          setStatus(downgradeStatus);
        }
      }, remainingGrace);
    } else {
      setStatus(downgradeStatus);
    }

    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      void openConnection();
    }, delay);
  }

  async function openConnection(): Promise<void> {
    if (disposed) {
      return;
    }

    clearReconnectTimer();
    closeEventSource();

    if (!hasConnected) {
      setStatus("connecting");
    } else if (status !== "connected") {
      setStatus("reconnecting");
    }

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

        hasConnected = true;
        markHealthy();
      };

      source.onmessage = (event: MessageEvent<string>) => {
        if (disposed) {
          return;
        }

        const payload = parseSsePayload(event.data);
        if (!payload) {
          return;
        }

        if (payload.type === "heartbeat") {
          if (hasConnected) {
            markHealthy();
          }
          return;
        }

        markHealthy();
        config.onEvent?.(payload);
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
      clearDowngradeTimer();
      closeEventSource();
      hasConnected = false;
      reconnectAttempt = 0;
      lastHealthyAt = 0;
      setStatus("offline");
    },
    getStatus() {
      return status;
    },
  };
}

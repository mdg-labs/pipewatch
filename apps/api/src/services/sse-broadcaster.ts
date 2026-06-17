import type { Redis } from "ioredis";

import {
  getSseChannel,
  SSE_HEARTBEAT_INTERVAL_MS,
  type SseEvent,
} from "@pipewatch/types";

export type SseBroadcasterOptions = {
  redis: Redis;
  workspaceId: string;
  repoId: string;
  signal: AbortSignal;
  onEvent: (event: SseEvent) => void | Promise<void>;
};

export type SseBroadcasterHandle = {
  cleanup: () => Promise<void>;
};

function parseSseMessage(message: string): SseEvent | null {
  try {
    return JSON.parse(message) as SseEvent;
  } catch {
    return null;
  }
}

/** Subscribe to repo-scoped Redis pub/sub and forward parsed SSE events. */
export async function subscribeSseBroadcaster(
  options: SseBroadcasterOptions,
): Promise<SseBroadcasterHandle> {
  const channel = getSseChannel(options.workspaceId, options.repoId);
  const subscriber = options.redis.duplicate();

  await subscriber.subscribe(channel);

  const onMessage = (receivedChannel: string, message: string): void => {
    if (receivedChannel !== channel) {
      return;
    }

    const event = parseSseMessage(message);
    if (!event) {
      return;
    }

    void options.onEvent(event);
  };

  subscriber.on("message", onMessage);

  const cleanup = async (): Promise<void> => {
    subscriber.removeListener("message", onMessage);
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  };

  options.signal.addEventListener(
    "abort",
    () => {
      void cleanup();
    },
    { once: true },
  );

  return { cleanup };
}

export function createHeartbeatEvent(): SseEvent {
  return {
    type: "heartbeat",
    data: { ts: Date.now() },
  };
}

export { SSE_HEARTBEAT_INTERVAL_MS };

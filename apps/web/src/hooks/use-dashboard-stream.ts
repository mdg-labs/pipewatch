"use client";

import type { SseDataEvent } from "@pipewatch/types";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveConnectionStatus } from "@/components/app-shell/LiveIndicator";
import { aggregateLiveStatus } from "@/lib/live-stream-status";
import { createRepoSseClient } from "@/lib/sse-client";
import { publicApiUrl } from "@/lib/env";

import { useApi } from "./use-api";

export type UseDashboardStreamOptions = {
  repoIds: readonly string[];
  enabled?: boolean;
  onEvent?: (repoId: string, event: SseDataEvent) => void;
};

export type UseDashboardStreamResult = {
  status: LiveConnectionStatus;
};

const DASHBOARD_CONNECT_STAGGER_MS = 150;

/** Subscribe to live pipeline events for all dashboard repositories (PRD §19, B3). */
export function useDashboardStream(
  options: UseDashboardStreamOptions,
): UseDashboardStreamResult {
  const { api, workspaceId } = useApi();
  const enabled = options.enabled ?? true;
  const repoIds = options.repoIds;
  const repoKey = repoIds.join(",");

  const [statusByRepo, setStatusByRepo] = useState<Record<string, LiveConnectionStatus>>({});
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const fetchToken = useCallback(
    () => api.get<{ token: string; expiresIn: number }>("/sse-token"),
    [api],
  );

  useEffect(() => {
    const ids = repoKey ? repoKey.split(",") : [];

    if (!enabled || !publicApiUrl || !workspaceId || ids.length === 0) {
      setStatusByRepo({});
      return;
    }

    let disposed = false;
    const clients: ReturnType<typeof createRepoSseClient>[] = [];
    const staggerTimers: ReturnType<typeof setTimeout>[] = [];

    for (const [index, repoId] of ids.entries()) {
      const client = createRepoSseClient({
        apiUrl: publicApiUrl,
        workspaceId,
        repoId,
        fetchToken,
        onStatusChange: (nextStatus) => {
          setStatusByRepo((current) => ({
            ...current,
            [repoId]: nextStatus,
          }));
        },
        onEvent: (event) => {
          onEventRef.current?.(repoId, event);
        },
      });

      clients.push(client);

      const timer = setTimeout(() => {
        if (!disposed) {
          client.connect();
        }
      }, index * DASHBOARD_CONNECT_STAGGER_MS);
      staggerTimers.push(timer);
    }

    return () => {
      disposed = true;
      for (const timer of staggerTimers) {
        clearTimeout(timer);
      }
      for (const client of clients) {
        client.disconnect();
      }
      setStatusByRepo({});
    };
  }, [enabled, workspaceId, repoKey, fetchToken]);

  const statuses = repoIds.map((repoId) => statusByRepo[repoId] ?? "offline");

  return {
    status: aggregateLiveStatus(statuses),
  };
}

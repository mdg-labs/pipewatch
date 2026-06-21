"use client";

import type { SseDataEvent } from "@pipewatch/types";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveConnectionStatus } from "@/components/app-shell/LiveIndicator";
import { createRepoSseClient } from "@/lib/sse-client";
import { publicApiUrl } from "@/lib/env";

import { useApi } from "./use-api";

export type UseRepoStreamOptions = {
  /** When omitted, derived from `/workspaces/:slug/repos/:repoId` routes. */
  repoId?: string | null;
  enabled?: boolean;
  onEvent?: (event: SseDataEvent) => void;
};

export type UseRepoStreamResult = {
  status: LiveConnectionStatus;
};

/** Extract repo id from workspace repo routes (B4, B4-runs, B5, B6). */
export function extractRepoIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/workspaces\/[^/]+\/repos\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

/** Subscribe to live pipeline events for the active repository (PRD §19, B22). */
export function useRepoStream(options: UseRepoStreamOptions = {}): UseRepoStreamResult {
  const pathname = usePathname() ?? "";
  const { api, workspaceId } = useApi();
  const repoIdFromPath = extractRepoIdFromPath(pathname);
  const repoId = options.repoId !== undefined ? options.repoId : repoIdFromPath;
  const enabled = options.enabled ?? true;

  const [status, setStatus] = useState<LiveConnectionStatus>("offline");
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const fetchToken = useCallback(
    () => api.get<{ token: string; expiresIn: number }>("/sse-token"),
    [api],
  );

  useEffect(() => {
    if (!enabled || !publicApiUrl || !workspaceId || !repoId) {
      setStatus("offline");
      return;
    }

    const client = createRepoSseClient({
      apiUrl: publicApiUrl,
      workspaceId,
      repoId,
      fetchToken,
      onStatusChange: setStatus,
      onEvent: (event) => {
        onEventRef.current?.(event);
      },
    });

    client.connect();

    return () => {
      client.disconnect();
    };
  }, [enabled, workspaceId, repoId, fetchToken]);

  return { status };
}

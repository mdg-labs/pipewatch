"use client";

import type { AccessTokenClaims, WorkspaceListItem } from "@pipewatch/types";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  createApiClient,
  type ApiClient,
  type WorkspaceScopedClient,
} from "@/lib/api-client";
import {
  decodeAccessTokenClaims,
  refreshAccessToken,
  resolveWorkspaceId,
  setAccessToken,
} from "@/lib/auth";
import { publicApiUrl } from "@/lib/env";

type ApiAuthContextValue = {
  accessToken: string | null;
  workspaces: readonly WorkspaceListItem[];
};

const ApiAuthContext = createContext<ApiAuthContextValue>({
  accessToken: null,
  workspaces: [],
});

export type ApiAuthProviderProps = {
  initialAccessToken?: string | null;
  workspaces?: readonly WorkspaceListItem[];
  children: ReactNode;
};

/**
 * Seeds the in-memory JWT from the server-read cookie and provides workspace
 * context to `useApi`. The token is exposed through context (not just the module
 * store) so claim-based workspace resolution re-renders when the seeded token
 * changes after `router.refresh()`.
 */
export function ApiAuthProvider({
  initialAccessToken = null,
  workspaces = [],
  children,
}: ApiAuthProviderProps) {
  // Mirror the cookie token into the in-memory api-client store synchronously so
  // the first request is authenticated. Browser-only: the module store is a
  // process global and must never be populated during server render.
  if (typeof window !== "undefined") {
    setAccessToken(initialAccessToken);
  }

  const value = useMemo(
    () => ({
      accessToken: initialAccessToken,
      workspaces,
    }),
    [initialAccessToken, workspaces],
  );

  return createElement(ApiAuthContext.Provider, { value }, children);
}

/** Resolution state of the active workspace for the current route. */
export type WorkspaceResolutionStatus = "ready" | "resolving" | "unresolved";

export type UseApiResult = {
  api: ApiClient;
  workspaceSlug: string | null;
  workspaceId: string | null;
  workspace: WorkspaceScopedClient | null;
  claims: AccessTokenClaims | null;
  workspaces: readonly WorkspaceListItem[];
  /**
   * `ready` — workspace resolved; `resolving` — slug present but workspace not
   * yet resolved (session recovery in flight); `unresolved` — recovery failed.
   */
  workspaceStatus: WorkspaceResolutionStatus;
};

function extractWorkspaceSlug(pathname: string): string | null {
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Typed API client scoped to the active workspace route (`/workspaces/:slug/...`). */
export function useApi(): UseApiResult {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { accessToken, workspaces } = useContext(ApiAuthContext);

  const onAuthRefreshed = useCallback(async () => {
    router.refresh();
  }, [router]);

  const api = useMemo(
    () =>
      createApiClient({
        apiUrl: publicApiUrl,
        onAuthRefreshed,
      }),
    [onAuthRefreshed],
  );

  const workspaceSlug = extractWorkspaceSlug(pathname);

  const claims = useMemo(
    () => (accessToken ? decodeAccessTokenClaims(accessToken) : null),
    [accessToken],
  );

  const workspaceId = useMemo(
    () => resolveWorkspaceId(workspaceSlug, workspaces, claims),
    [workspaceSlug, workspaces, claims],
  );

  const workspace = useMemo(
    () => (workspaceId ? api.workspace(workspaceId) : null),
    [api, workspaceId],
  );

  // Recover a transient session bootstrap failure: a workspace route is active
  // but no workspace id resolves (empty SSR session + expired/missing access
  // token). Refresh the session client-side once, then re-run the server render
  // so the layout re-seeds workspaces and the access token (PRD §7.1, B3).
  const recoveryAttempted = useRef(false);
  const [recoveryFailed, setRecoveryFailed] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      recoveryAttempted.current = false;
      setRecoveryFailed(false);
      return;
    }

    if (!workspaceSlug || recoveryAttempted.current) {
      return;
    }

    recoveryAttempted.current = true;
    let active = true;

    void (async () => {
      const result = await refreshAccessToken({ apiUrl: publicApiUrl });
      if (!active) {
        return;
      }

      if (result.ok) {
        router.refresh();
      } else {
        setRecoveryFailed(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [workspaceId, workspaceSlug, router]);

  const workspaceStatus: WorkspaceResolutionStatus = workspaceId
    ? "ready"
    : workspaceSlug && !recoveryFailed
      ? "resolving"
      : "unresolved";

  return {
    api,
    workspaceSlug,
    workspaceId,
    workspace,
    claims,
    workspaces,
    workspaceStatus,
  };
}

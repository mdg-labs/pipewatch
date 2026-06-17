"use client";

import type { WorkspaceListItem } from "@pipewatch/types";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import {
  createApiClient,
  type ApiClient,
  type WorkspaceScopedClient,
} from "@/lib/api-client";
import {
  getAccessTokenClaims,
  resolveWorkspaceId,
  setAccessToken,
} from "@/lib/auth";
import { publicApiUrl } from "@/lib/env";

type ApiAuthContextValue = {
  initialAccessToken: string | null;
  workspaces: readonly WorkspaceListItem[];
};

const ApiAuthContext = createContext<ApiAuthContextValue>({
  initialAccessToken: null,
  workspaces: [],
});

export type ApiAuthProviderProps = {
  initialAccessToken?: string | null;
  workspaces?: readonly WorkspaceListItem[];
  children: ReactNode;
};

/** Seeds in-memory JWT from the server and provides workspace context to `useApi`. */
export function ApiAuthProvider({
  initialAccessToken = null,
  workspaces = [],
  children,
}: ApiAuthProviderProps) {
  useEffect(() => {
    if (initialAccessToken) {
      setAccessToken(initialAccessToken);
    }
  }, [initialAccessToken]);

  const value = useMemo(
    () => ({
      initialAccessToken,
      workspaces,
    }),
    [initialAccessToken, workspaces],
  );

  return createElement(ApiAuthContext.Provider, { value }, children);
}

export type UseApiResult = {
  api: ApiClient;
  workspaceSlug: string | null;
  workspaceId: string | null;
  workspace: WorkspaceScopedClient | null;
  claims: ReturnType<typeof getAccessTokenClaims>;
  workspaces: readonly WorkspaceListItem[];
};

function extractWorkspaceSlug(pathname: string): string | null {
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Typed API client scoped to the active workspace route (`/workspaces/:slug/...`). */
export function useApi(): UseApiResult {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { workspaces } = useContext(ApiAuthContext);

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
  const workspaceId = resolveWorkspaceId(workspaceSlug, workspaces);
  const claims = getAccessTokenClaims();

  const workspace = workspaceId ? api.workspace(workspaceId) : null;

  return {
    api,
    workspaceSlug,
    workspaceId,
    workspace,
    claims,
    workspaces,
  };
}

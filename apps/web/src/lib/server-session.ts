import type { WorkspaceListItem } from "@pipewatch/types";

import { publicApiUrl } from "./env";
import {
  EMPTY_APP_SESSION,
  type AppSession,
  type AppSessionUser,
} from "./placeholder-session";

type UserProfileResponse = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  github_login: string;
};

export type FetchAppSessionOptions = {
  accessToken: string | null;
  activeWorkspaceSlug?: string | undefined;
  fetchImpl?: typeof fetch;
};

function mapUserProfile(profile: UserProfileResponse): AppSessionUser {
  return {
    name: profile.name?.trim() || profile.github_login,
    githubLogin: profile.github_login,
    ...(profile.avatar_url ? { avatarUrl: profile.avatar_url } : {}),
  };
}

function resolveActiveWorkspace(
  workspaces: WorkspaceListItem[],
  preferredSlug?: string,
): WorkspaceListItem | null {
  if (workspaces.length === 0) {
    return null;
  }

  if (preferredSlug) {
    const match = workspaces.find((workspace) => workspace.slug === preferredSlug);
    if (match) {
      return match;
    }
  }

  return workspaces[0] ?? null;
}

/** Load authenticated user profile and workspace list from the API (server-side). */
export async function fetchAppSession(
  options: FetchAppSessionOptions,
): Promise<AppSession> {
  if (!publicApiUrl || !options.accessToken) {
    return EMPTY_APP_SESSION;
  }

  const base = publicApiUrl.replace(/\/$/, "");
  const fetchFn = options.fetchImpl ?? fetch;
  const headers = {
    Authorization: `Bearer ${options.accessToken}`,
    Accept: "application/json",
  };

  try {
    const [userResponse, workspacesResponse] = await Promise.all([
      fetchFn(`${base}/api/v1/users/me`, { headers, cache: "no-store" }),
      fetchFn(`${base}/api/v1/workspaces`, { headers, cache: "no-store" }),
    ]);

    if (!userResponse.ok || !workspacesResponse.ok) {
      return EMPTY_APP_SESSION;
    }

    const profile = (await userResponse.json()) as UserProfileResponse;
    const workspaces = (await workspacesResponse.json()) as WorkspaceListItem[];
    const activeWorkspace = resolveActiveWorkspace(workspaces, options.activeWorkspaceSlug);

    if (!activeWorkspace) {
      return {
        authenticated: true,
        user: mapUserProfile(profile),
        workspaces,
        activeWorkspaceSlug: "",
        role: "member",
      };
    }

    return {
      authenticated: true,
      user: mapUserProfile(profile),
      workspaces,
      activeWorkspaceSlug: activeWorkspace.slug,
      role: activeWorkspace.role,
    };
  } catch {
    return EMPTY_APP_SESSION;
  }
}

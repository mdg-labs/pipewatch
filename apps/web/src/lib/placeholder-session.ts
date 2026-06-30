import type { WorkspaceListItem, WorkspaceRole } from "@pipewatch/types";

/** User profile shown in the app shell. */
export type AppSessionUser = {
  name: string;
  githubLogin: string;
  avatarUrl?: string | undefined;
};

/** Session context passed into the app shell. */
export type AppSession = {
  /**
   * True when the server successfully authenticated the request (valid access
   * token). False means the bootstrap failed (e.g. expired token) — callers must
   * not treat an empty `workspaces` list as a genuine zero-workspace user.
   */
  authenticated: boolean;
  user: AppSessionUser;
  workspaces: WorkspaceListItem[];
  activeWorkspaceSlug: string;
  role: WorkspaceRole;
};

/** Empty session when the API is unreachable or the access token is invalid. */
export const EMPTY_APP_SESSION: AppSession = {
  authenticated: false,
  user: { name: "", githubLogin: "" },
  workspaces: [],
  activeWorkspaceSlug: "",
  role: "member",
};

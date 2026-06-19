import type { WorkspaceListItem, WorkspaceRole } from "@pipewatch/types";

/** User profile shown in the app shell. */
export type AppSessionUser = {
  name: string;
  githubLogin: string;
  avatarUrl?: string | undefined;
};

/** Session context passed into the app shell. */
export type AppSession = {
  user: AppSessionUser;
  workspaces: WorkspaceListItem[];
  activeWorkspaceSlug: string;
  role: WorkspaceRole;
};

/** Empty session when the API is unreachable during server render. */
export const EMPTY_APP_SESSION: AppSession = {
  user: { name: "", githubLogin: "" },
  workspaces: [],
  activeWorkspaceSlug: "",
  role: "member",
};

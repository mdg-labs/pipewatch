import type { WorkspaceListItem, WorkspaceRole } from "@pipewatch/types";

/** Placeholder user profile until the API client (#81) is wired. */
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

const MOCK_WORKSPACES: WorkspaceListItem[] = [
  {
    id: "ws_mock_mdg",
    name: "MDG Labs",
    slug: "mdg-labs",
    plan: "pro",
    default_retention_days: 30,
    created_at: "2026-01-01T00:00:00.000Z",
    role: "owner",
  },
  {
    id: "ws_mock_side",
    name: "Side Project",
    slug: "side-project",
    plan: "free",
    default_retention_days: 7,
    created_at: "2026-02-01T00:00:00.000Z",
    role: "admin",
  },
];

const MOCK_USER: AppSessionUser = {
  name: "Michael",
  githubLogin: "michaeldg",
};

/** Returns placeholder session data for shell rendering before API integration. */
export function getPlaceholderSession(
  activeWorkspaceSlug = "mdg-labs",
): AppSession {
  const workspace =
    MOCK_WORKSPACES.find((item) => item.slug === activeWorkspaceSlug) ??
    MOCK_WORKSPACES[0]!;

  return {
    user: MOCK_USER,
    workspaces: MOCK_WORKSPACES,
    activeWorkspaceSlug: workspace.slug,
    role: workspace.role,
  };
}

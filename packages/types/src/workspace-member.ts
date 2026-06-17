import type { WorkspaceRole } from "./common.js";

/** Workspace member returned by `GET /api/v1/workspaces/:workspaceId/members`. */
export type WorkspaceMember = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: WorkspaceRole;
  joined_at: string;
};

/** Body for `PATCH /api/v1/workspaces/:workspaceId/members/:userId`. */
export type UpdateWorkspaceMemberInput = {
  role: WorkspaceRole;
};

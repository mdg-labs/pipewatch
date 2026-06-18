import type { WorkspaceRole } from "./common.js";

/** Pending workspace invite (PRD §7 — `GET /workspaces/:id/invites`). */
export type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  invited_at: string;
  expires_at: string;
  email_sent: boolean;
  invite_url?: string | undefined;
};

export type CreateWorkspaceInviteInput = {
  email: string;
  role: WorkspaceRole;
};

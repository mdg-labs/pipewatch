import type { WorkspaceRole } from "./common.js";

/** Workspace plan tier (PRD §8). */
export type WorkspacePlan = "free" | "pro" | "business";

/** Workspace resource returned by workspace API routes. */
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  default_retention_days: number;
  created_at: string;
};

/** Workspace list item includes the caller's membership role. */
export type WorkspaceListItem = Workspace & {
  role: WorkspaceRole;
};

/** Body for `POST /api/v1/workspaces`. */
export type CreateWorkspaceInput = {
  name: string;
  slug?: string | undefined;
};

/** Body for `PATCH /api/v1/workspaces/:workspaceId`. */
export type UpdateWorkspaceInput = {
  name?: string | undefined;
  slug?: string | undefined;
  default_retention_days?: number | undefined;
};

/** Response for `GET /api/v1/workspaces/check-slug`. */
export type SlugAvailability = {
  available: boolean;
  slug: string;
};

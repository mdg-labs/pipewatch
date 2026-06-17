import type { WorkspaceContext } from "./lib/workspace-context.js";

/** Hono context variables shared across API middleware and routes. */
export type ApiVariables = {
  requestId: string;
  workspaceContext?: WorkspaceContext;
};

export type ApiEnv = {
  Variables: ApiVariables;
};

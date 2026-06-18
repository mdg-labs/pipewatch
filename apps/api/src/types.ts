import type { WorkspaceContext } from "./lib/workspace-context.js";
import type { ApiKeyAuthIdentity } from "@pipewatch/types";

/** Hono context variables shared across API middleware and routes. */
export type ApiVariables = {
  requestId: string;
  workspaceContext?: WorkspaceContext;
  apiKeyAuthIdentity?: ApiKeyAuthIdentity;
};

export type ApiEnv = {
  Variables: ApiVariables;
};

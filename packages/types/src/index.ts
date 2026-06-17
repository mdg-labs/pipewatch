export type {
  ApiError,
  IntegrationProvider,
  PaginatedResponse,
  PipelineConclusion,
  PipelineStatus,
  WorkspaceRole,
} from "./common.js";

export type {
  AccessTokenClaims,
  GitHubUserProfile,
  OAuthStatePayload,
} from "./auth.js";

export type { Integration } from "./integration.js";

export type {
  PipelineJob,
  PipelineJobSummary,
} from "./pipeline-job.js";

export type { PipelineRun, PipelineRunSummary } from "./pipeline-run.js";

export type { PipelineStep } from "./pipeline-step.js";

/** Stub compat for app skeletons — remove when apps adopt real types. */
export type Placeholder = Record<string, never>;

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

export type {
  CreateIntegrationInput,
  Integration,
  IntegrationAccountType,
  IntegrationSummary,
  IntegrationTokenHealth,
} from "./integration.js";

export type {
  PipelineJob,
  PipelineJobSummary,
} from "./pipeline-job.js";

export type {
  ListPipelineRunsQuery,
  PaginatedPipelineRuns,
  PipelineRun,
  PipelineRunSummary,
} from "./pipeline-run.js";

export type { PipelineStep } from "./pipeline-step.js";

export type {
  ListRepositoriesQuery,
  RepositorySummary,
  UpdateRepositoryInput,
} from "./repository.js";

export { API_KEY_PREFIX } from "./api-key.js";

export type {
  ApiKeyAuthIdentity,
  ApiKeySummary,
  CreateApiKeyInput,
  CreatedApiKey,
} from "./api-key.js";

export type { UpdateUserProfileInput, UserProfile } from "./user.js";

export type {
  CreateWorkspaceInput,
  SlugAvailability,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceListItem,
  WorkspacePlan,
} from "./workspace.js";

export type {
  UpdateWorkspaceMemberInput,
  WorkspaceMember,
} from "./workspace-member.js";

/** Stub compat for app skeletons — remove when apps adopt real types. */
export type Placeholder = Record<string, never>;

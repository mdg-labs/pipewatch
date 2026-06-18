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
  PipelineJobsList,
} from "./pipeline-job.js";

export type {
  ListPipelineRunsQuery,
  PaginatedPipelineRuns,
  PipelineRun,
  PipelineRunSummary,
} from "./pipeline-run.js";

export type { PipelineStep, PipelineStepsList } from "./pipeline-step.js";

export type {
  InsightsMostActiveRepo,
  InsightsMostFailingWorkflow,
  InsightsQuery,
  InsightsRange,
  InsightsSlowestWorkflow,
  InsightsSummary,
  InsightsTimeSeries,
  InsightsTimeSeriesDay,
  InsightsTimeSeriesPoint,
  WorkspaceInsights,
} from "./insights.js";

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

export type {
  CreateWorkspaceInviteInput,
  WorkspaceInvite,
} from "./workspace-invite.js";

export type {
  BillingCheckoutInput,
  BillingInvoice,
  BillingSessionUrl,
  BillingUsageMetric,
  WorkspaceBillingSummary,
} from "./billing.js";

export type {
  SseDataEvent,
  SseEvent,
  SseEventType,
  SseHeartbeatData,
  SseHeartbeatEvent,
  SseJobUpdatedEvent,
  SseRunCompletedEvent,
  SseRunCreatedEvent,
  SseRunUpdatedEvent,
} from "./sse-events.js";

export {
  getSseChannel,
  SSE_CHANNEL_PREFIX,
  SSE_HEARTBEAT_INTERVAL_MS,
} from "./sse-events.js";

/** Stub compat for app skeletons — remove when apps adopt real types. */
export type Placeholder = Record<string, never>;

export type AdminRole = "viewer" | "operator" | "platform_admin";

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
};

export type WebhookHealthOverall = {
  total: number;
  successCount: number;
  failureCount: number;
  unreachableCount: number;
  failureRate: number;
};

export type WebhookHealthInstallation = WebhookHealthOverall & {
  externalInstallationId: string;
  workspaceId: string | null;
};

export type WebhookHealthSummary = {
  windowMinutes: number;
  overall: WebhookHealthOverall;
  installations: WebhookHealthInstallation[];
};

export type WebhookPollCoverage = {
  lastDeliveryAt: string | null;
  lastPollAt: string | null;
  pollFreshnessSeconds: number | null;
  ingestLagSeconds: number | null;
  pollFreshnessOk: boolean;
  ingestLagOk: boolean;
};

export type DeliveryOutcome = "success" | "http_failure" | "unreachable";

export type WebhookDeliveryItem = {
  id: string;
  githubDeliveryId: string;
  githubGuid: string;
  externalInstallationId: string | null;
  integrationId: string | null;
  workspaceId: string | null;
  event: string;
  action: string | null;
  statusCode: number;
  status: string;
  duration: number | null;
  redelivery: boolean;
  outcome: DeliveryOutcome;
  deliveredAt: string;
  polledAt: string;
  createdAt: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type WorkspaceOverview = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  createdAt: string;
  defaultRetentionDays: number;
  integrationCount: number;
  memberCount: number;
};

export type IntegrationOverview = {
  id: string;
  workspaceId: string;
  externalInstallationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
};

export type AdminInvite = {
  id: string;
  email: string;
  role: AdminRole;
  invited_at: string;
  expires_at: string;
  email_sent: boolean;
  invite_url?: string;
};

export type DeliveryListQuery = {
  page?: number;
  page_size?: number;
  outcome?: DeliveryOutcome;
  status_code?: number;
  unreachable?: boolean;
  workspace_id?: string;
  installation_id?: string;
  event?: string;
};

export type WorkspacesByPlan = {
  free: number;
  pro: number;
  business: number;
};

export type PlatformMetricsSummary = {
  totalWorkspaces: number;
  totalIntegrations: number;
  totalProductUsers: number;
  totalPipelineRuns: number;
  pipelineRunsLast30Days: number;
  workspacesByPlan: WorkspacesByPlan;
};

export type PlatformMetricsWorkspace = {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  integrationCount: number;
  pipelineRunCount: number;
};

export type RecentWebhookHealthSummary = {
  windowMinutes: number;
  total: number;
  successCount: number;
  failureCount: number;
  unreachableCount: number;
  failureRate: number;
};

export type WorkspaceIntegrationSummary = {
  id: string;
  externalInstallationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: string;
};

export type WorkspaceMemberSummary = {
  userId: string;
  email: string | null;
  role: string;
};

export type WorkspaceDetail = WorkspaceOverview & {
  integrations: WorkspaceIntegrationSummary[];
  members: WorkspaceMemberSummary[];
  recentWebhookHealth: RecentWebhookHealthSummary;
};

export type IntegrationDetail = {
  id: string;
  workspaceId: string;
  externalInstallationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: string;
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
  recentWebhookHealth: RecentWebhookHealthSummary;
};

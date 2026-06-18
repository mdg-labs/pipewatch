/** Scalar / OpenAPI tag names — one tag per PRD §7 resource group. */
export const OpenApiTags = {
  AUTH: "Auth",
  WORKSPACES: "Workspaces",
  MEMBERS: "Members",
  INVITES: "Invites",
  INTEGRATIONS: "Integrations",
  REPOSITORIES: "Repositories",
  PIPELINE_RUNS: "Pipeline Runs",
  PIPELINE_JOBS: "Pipeline Jobs",
  PIPELINE_STEPS: "Pipeline Steps",
  API_KEYS: "API Keys",
  INSIGHTS: "Insights",
  BILLING: "Billing",
  SSE: "SSE",
  WEBHOOKS: "Webhooks",
  WAITLIST: "Waitlist",
  ONBOARDING: "Onboarding",
  PUBLIC: "Public",
  USERS: "Users",
  SYSTEM: "System",
} as const;

export type OpenApiTag = (typeof OpenApiTags)[keyof typeof OpenApiTags];

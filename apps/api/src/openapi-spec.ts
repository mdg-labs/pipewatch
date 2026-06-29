/** PRD §7 example routes — core paths always present in the OpenAPI spec. */
export const PRD_CORE_OPENAPI_PATHS = [
  "/api/v1/workspaces",
  "/api/v1/workspaces/{workspaceId}",
  "/api/v1/workspaces/{workspaceId}/integrations",
  "/api/v1/workspaces/{workspaceId}/integrations/{integrationId}",
  "/api/v1/workspaces/{workspaceId}/repositories",
  "/api/v1/workspaces/{workspaceId}/repositories/{repoId}",
  "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs",
  "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}",
  "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}/jobs",
  "/api/v1/workspaces/{workspaceId}/repositories/{repoId}/runs/{runId}/jobs/{jobId}/steps",
  "/api/v1/workspaces/{workspaceId}/insights",
  "/api/v1/workspaces/{workspaceId}/api-keys",
  "/api/v1/workspaces/{workspaceId}/api-keys/{keyId}",
  "/api/v1/workspaces/{workspaceId}/members",
  "/api/v1/workspaces/{workspaceId}/members/{userId}",
  "/api/v1/workspaces/{workspaceId}/invites",
  "/api/v1/workspaces/{workspaceId}/invites/{inviteId}",
  "/api/v1/sse-token",
  "/api/v1/workspaces/{workspaceId}/repos/{repoId}/stream",
  "/auth/github",
  "/auth/github/callback",
  "/auth/refresh",
  "/auth/logout",
  "/auth/logout-all",
  "/auth/switch-workspace",
  "/onboarding/github-callback",
  "/invite/{token}",
  "/invite/{token}/accept",
  "/webhooks/github",
  "/health",
  "/version",
] as const;

/** Cloud-only PRD §7 routes — registered when `PIPEWATCH_EDITION=cloud`. */
export const PRD_CLOUD_OPENAPI_PATHS = [
  "/webhooks/stripe",
  "/webhooks/postmark",
  "/api/v1/workspaces/{workspaceId}/billing",
  "/api/v1/workspaces/{workspaceId}/billing/checkout",
  "/api/v1/workspaces/{workspaceId}/billing/portal",
  "/api/v1/waitlist",
  "/api/v1/waitlist/confirm/{token}",
  "/api/v1/waitlist/unsubscribe/{token}",
] as const;

/** Expected Scalar resource tags (PRD §7 resource groups). */
export const PRD_OPENAPI_TAGS = [
  "Auth",
  "Workspaces",
  "Members",
  "Invites",
  "Integrations",
  "Repositories",
  "Pipeline Runs",
  "Pipeline Jobs",
  "Pipeline Steps",
  "API Keys",
  "Insights",
  "Billing",
  "SSE",
  "Webhooks",
  "Waitlist",
  "Onboarding",
  "Public",
  "Users",
  "System",
] as const;

export type OpenApiSpec = {
  openapi?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown>; securitySchemes?: Record<string, unknown> };
  tags?: Array<{ name: string }>;
  "x-tagGroups"?: Array<{ name: string; tags: string[] }>;
};

/** Sort object keys recursively for stable snapshot comparison. */
export function normalizeOpenApiSpec(spec: OpenApiSpec): OpenApiSpec {
  const sortedPaths: Record<string, Record<string, unknown>> = {};
  for (const path of Object.keys(spec.paths ?? {}).sort()) {
    const methods = spec.paths![path]!;
    const sortedMethods: Record<string, unknown> = {};
    for (const method of Object.keys(methods).sort()) {
      sortedMethods[method] = methods[method];
    }
    sortedPaths[path] = sortedMethods;
  }

  const sortedSchemas: Record<string, unknown> = {};
  for (const name of Object.keys(spec.components?.schemas ?? {}).sort()) {
    sortedSchemas[name] = spec.components!.schemas![name];
  }

  const components: OpenApiSpec["components"] = {
    schemas: sortedSchemas,
  };
  if (spec.components?.securitySchemes) {
    components.securitySchemes = spec.components.securitySchemes;
  }

  const normalized: OpenApiSpec = {
    paths: sortedPaths,
    components,
  };

  if (spec.openapi !== undefined) {
    normalized.openapi = spec.openapi;
  }
  if (spec.info !== undefined) {
    normalized.info = spec.info;
  }
  if (spec["x-tagGroups"] !== undefined) {
    normalized["x-tagGroups"] = spec["x-tagGroups"];
  }

  return normalized;
}

export function collectOperationTags(spec: OpenApiSpec): string[] {
  const tags = new Set<string>();
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (
        operation &&
        typeof operation === "object" &&
        "tags" in operation &&
        Array.isArray(operation.tags)
      ) {
        for (const tag of operation.tags) {
          if (typeof tag === "string") {
            tags.add(tag);
          }
        }
      }
    }
  }
  return [...tags].sort();
}

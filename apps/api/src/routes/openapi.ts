import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { OpenApiTags } from "../openapi-tags.js";
import type { ApiEnv } from "../types.js";

export const OPENAPI_SPEC_PATH = "/api/v1/openapi.json";
export const OPENAPI_DOCS_PATH = "/api/docs";

/** Scalar tag groups — one group per PRD §7 resource area. */
const OPENAPI_TAG_GROUPS = [
  {
    name: "Core",
    tags: [OpenApiTags.SYSTEM, OpenApiTags.PUBLIC, OpenApiTags.USERS],
  },
  {
    name: "Authentication",
    tags: [OpenApiTags.AUTH, OpenApiTags.ONBOARDING, OpenApiTags.INVITES],
  },
  {
    name: "Workspace",
    tags: [
      OpenApiTags.WORKSPACES,
      OpenApiTags.MEMBERS,
      OpenApiTags.INVITES,
      OpenApiTags.API_KEYS,
    ],
  },
  {
    name: "Integrations & Repositories",
    tags: [OpenApiTags.INTEGRATIONS, OpenApiTags.REPOSITORIES],
  },
  {
    name: "Pipelines",
    tags: [
      OpenApiTags.PIPELINE_RUNS,
      OpenApiTags.PIPELINE_JOBS,
      OpenApiTags.PIPELINE_STEPS,
      OpenApiTags.INSIGHTS,
      OpenApiTags.SSE,
    ],
  },
  {
    name: "Billing & Marketing",
    tags: [OpenApiTags.BILLING, OpenApiTags.WAITLIST],
  },
  {
    name: "Webhooks",
    tags: [OpenApiTags.WEBHOOKS],
  },
] as const;

/** Serve generated OpenAPI spec and Scalar interactive docs. */
export function registerOpenApiRoutes(app: OpenAPIHono<ApiEnv>): void {
  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Short-lived JWT from GitHub OAuth. Send as `Authorization: Bearer <token>`.",
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "apiKeyAuth", {
    type: "http",
    scheme: "bearer",
    description: "Workspace API key. Send as `Authorization: Bearer pw_<key>`.",
  });

  app.doc(OPENAPI_SPEC_PATH, {
    openapi: "3.0.0",
    info: {
      title: "PipeWatch API",
      version: "1.0.0",
      description:
        "PipeWatch REST API for workspace-scoped CI pipeline monitoring. " +
        "Authenticate with a browser session JWT or a workspace API key (`pw_` prefix).",
    },
    "x-tagGroups": OPENAPI_TAG_GROUPS,
  });

  app.get(
    OPENAPI_DOCS_PATH,
    Scalar({
      url: OPENAPI_SPEC_PATH,
      pageTitle: "PipeWatch API",
      documentDownloadType: "json",
      authentication: {
        preferredSecurityScheme: ["bearerAuth", "apiKeyAuth"],
        securitySchemes: {
          bearerAuth: {
            token: "",
          },
          apiKeyAuth: {
            token: "pw_",
          },
        },
      },
    }),
  );
}

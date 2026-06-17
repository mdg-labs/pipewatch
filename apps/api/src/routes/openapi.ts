import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import type { ApiEnv } from "../types.js";

export const OPENAPI_SPEC_PATH = "/api/v1/openapi.json";
export const OPENAPI_DOCS_PATH = "/api/docs";

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

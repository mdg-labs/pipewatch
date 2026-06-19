import { createRoute, z } from "@hono/zod-openapi";
import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { ApiErrorEnvelopeSchema } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import type { ApiEnv } from "../../types.js";

const AppConfigResponseSchema = z
  .object({
    github_app_slug: z
      .string()
      .min(1)
      .nullable()
      .openapi({ example: "pipewatch" }),
  })
  .openapi("AppConfigResponse");

const appConfigRoute = createRoute({
  method: "get",
  path: "/api/v1/public/app-config",
  tags: [OpenApiTags.PUBLIC],
  summary: "Public app configuration",
  description:
    "Unauthenticated runtime configuration for the web app (GitHub App install URL slug). " +
    "Sourced from API container env — not baked into the web build.",
  responses: {
    200: {
      description: "Public app configuration",
      content: {
        "application/json": {
          schema: AppConfigResponseSchema,
        },
      },
    },
    500: {
      description: "Unexpected server error",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type AppConfigDependencies = {
  env?: ParsedApiEnv;
};

/** Register the public app config route (PRD §13, §23). */
export function registerAppConfigRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: AppConfigDependencies,
): void {
  app.openapi(appConfigRoute, async (c) => {
    const env = deps?.env ?? parseApiEnv();
    const slug = env.GITHUB_APP_SLUG?.trim() ?? null;

    return c.json({ github_app_slug: slug && slug.length > 0 ? slug : null }, 200);
  });
}

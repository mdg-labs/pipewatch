import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import packageJson from "../../package.json" with { type: "json" };
import { ApiErrorEnvelopeSchema } from "../middleware/error-handler.js";
import { OpenApiTags } from "../openapi-tags.js";
import type { ApiEnv } from "../types.js";

const VersionResponseSchema = z
  .object({
    version: z.string().openapi({ example: "0.1.0" }),
  })
  .openapi("VersionResponse");

const versionRoute = createRoute({
  method: "get",
  path: "/version",
  tags: [OpenApiTags.SYSTEM],
  summary: "Deployed package version",
  description: "Public semver probe for deploy planning — no authentication required.",
  responses: {
    200: {
      description: "Current deployable version",
      content: {
        "application/json": {
          schema: VersionResponseSchema,
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

/** Register the public version probe route. */
export function registerVersionRoute(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(versionRoute, (c) =>
    c.json(
      {
        version: packageJson.version,
      },
      200,
    ),
  );
}

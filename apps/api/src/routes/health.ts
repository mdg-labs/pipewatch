import { createRoute, z } from "@hono/zod-openapi";
import { flags } from "@pipewatch/config/edition";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { ApiErrorEnvelopeSchema } from "../middleware/error-handler.js";
import { OpenApiTags } from "../openapi-tags.js";
import type { ApiEnv } from "../types.js";

const HealthResponseSchema = z
  .object({
    status: z.literal("ok").openapi({ example: "ok" }),
    edition: z.enum(["ce", "cloud"]).openapi({ example: "ce" }),
  })
  .openapi("HealthResponse");

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: [OpenApiTags.SYSTEM],
  summary: "Health check",
  description: "Public liveness probe — no authentication required.",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
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

/** Register the public health check route. */
export function registerHealthRoute(app: OpenAPIHono<ApiEnv>): void {
  app.openapi(healthRoute, (c) =>
    c.json(
      {
        status: "ok" as const,
        edition: flags.IS_CE ? ("ce" as const) : ("cloud" as const),
      },
      200,
    ),
  );
}

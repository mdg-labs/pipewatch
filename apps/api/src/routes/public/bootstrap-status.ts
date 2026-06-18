import { createRoute, z } from "@hono/zod-openapi";
import { flags } from "@pipewatch/config/edition";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getDb, type Db } from "@pipewatch/db";

import { ApiErrorEnvelopeSchema } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import { countUsers } from "../../services/auth/oauth.js";
import type { ApiEnv } from "../../types.js";

const BootstrapStatusResponseSchema = z
  .object({
    bootstrapRequired: z.boolean().openapi({ example: true }),
    userCount: z.number().int().nonnegative().openapi({ example: 0 }),
  })
  .openapi("BootstrapStatusResponse");

const bootstrapStatusRoute = createRoute({
  method: "get",
  path: "/api/v1/public/bootstrap-status",
  tags: [OpenApiTags.PUBLIC],
  summary: "CE bootstrap status",
  description:
    "Public endpoint for the web app to detect whether CE first-run bootstrap is required. " +
    "No authentication required.",
  responses: {
    200: {
      description: "Bootstrap status for the current edition",
      content: {
        "application/json": {
          schema: BootstrapStatusResponseSchema,
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

export type BootstrapStatusDependencies = {
  db: Db;
};

/** Register the public bootstrap status route (PRD §26, pages B0). */
export function registerBootstrapStatusRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: BootstrapStatusDependencies,
): void {
  app.openapi(bootstrapStatusRoute, async (c) => {
    const database = deps?.db ?? getDb();
    const userCount = await countUsers(database);
    const bootstrapRequired = flags.BOOTSTRAP_ENABLED && userCount === 0;

    return c.json({ bootstrapRequired, userCount }, 200);
  });
}

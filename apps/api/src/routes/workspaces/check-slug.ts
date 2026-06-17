import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { getDb, type Db } from "@pipewatch/db";

import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import {
  checkSlugAvailability,
  WorkspaceError,
} from "../../services/workspaces/workspace.service.js";
import type { ApiEnv } from "../../types.js";

const CheckSlugQuerySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .openapi({ example: "my-workspace" }),
  exclude: z
    .string()
    .uuid()
    .optional()
    .openapi({
      description: "Workspace ID to exclude when checking availability during edits",
      example: "00000000-0000-4000-8000-000000000001",
    }),
});

const SlugAvailabilitySchema = z
  .object({
    available: z.boolean().openapi({ example: true }),
    slug: z.string().openapi({ example: "my-workspace" }),
  })
  .openapi("SlugAvailability");

const checkSlugRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/check-slug",
  tags: ["Workspaces"],
  summary: "Check workspace slug availability",
  description:
    "Public endpoint used during onboarding and workspace settings to verify slug uniqueness.",
  request: {
    query: CheckSlugQuerySchema,
  },
  responses: {
    200: {
      description: "Slug availability result",
      content: {
        "application/json": {
          schema: SlugAvailabilitySchema,
        },
      },
    },
    422: {
      description: "Invalid slug format",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type CheckSlugDependencies = {
  db: Db;
};

/** Register slug availability route (pages B2, B8). */
export function registerCheckSlugRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<CheckSlugDependencies>,
): void {
  const resolveDatabase = (): Db => deps?.db ?? getDb();

  app.openapi(checkSlugRoute, async (c) => {
    const { slug, exclude } = c.req.valid("query");

    try {
      const result = await checkSlugAvailability(resolveDatabase(), slug, exclude);
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return c.json(apiError(error.code, error.message), error.status as 422);
      }

      throw error;
    }
  });
}

import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import {
  getWorkspaceContext,
  resolveAuthIdentity,
  roleMeetsMinimum,
} from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { workspaceScope } from "../../middleware/workspace-scope.js";
import {
  createWorkspaceSafe,
  deleteWorkspace,
  getWorkspaceForMember,
  listWorkspacesForUser,
  updateWorkspaceSafe,
  WorkspaceError,
} from "../../services/workspaces/workspace.service.js";
import type { ApiEnv } from "../../types.js";
import { requireJwtSecret } from "../auth/shared.js";
import { registerCheckSlugRoute } from "./check-slug.js";

const WorkspacePlanSchema = z.enum(["free", "pro", "business"]);

const WorkspaceSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    plan: WorkspacePlanSchema,
    default_retention_days: z.number().int(),
    created_at: z.string().datetime(),
  })
  .openapi("Workspace");

const WorkspaceListItemSchema = WorkspaceSchema.extend({
  role: z.enum(["owner", "admin", "member"]),
}).openapi("WorkspaceListItem");

const CreateWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(256).openapi({ example: "My Workspace" }),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .openapi({ example: "my-workspace" }),
  })
  .openapi("CreateWorkspaceBody");

const UpdateWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional().openapi({ example: "Renamed Workspace" }),
    slug: z.string().trim().min(1).max(64).optional().openapi({ example: "renamed-workspace" }),
    default_retention_days: z
      .number()
      .int()
      .optional()
      .openapi({ example: 90 }),
  })
  .openapi("UpdateWorkspaceBody");

const listWorkspacesRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces",
  tags: ["Workspaces"],
  summary: "List workspaces for the authenticated user",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Workspaces the user belongs to",
      content: {
        "application/json": {
          schema: z.array(WorkspaceListItemSchema),
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const createWorkspaceRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces",
  tags: ["Workspaces"],
  summary: "Create a workspace",
  description:
    "Creates a workspace, auto-generates a slug from the name when omitted, and assigns the creator as owner.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateWorkspaceBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created workspace",
      content: {
        "application/json": {
          schema: WorkspaceSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Workspace limit reached",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Slug collision",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    422: {
      description: "Request validation failed",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const getWorkspaceRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Get workspace details",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Workspace details",
      content: {
        "application/json": {
          schema: WorkspaceSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const patchWorkspaceRoute = createRoute({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Update workspace settings",
  description: "Updates name, slug, and default retention (cloud paid plans: 30–365 days).",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateWorkspaceBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated workspace",
      content: {
        "application/json": {
          schema: WorkspaceSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Slug collision",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    422: {
      description: "Request validation failed",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const deleteWorkspaceRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Delete a workspace",
  description:
    "Deletes the workspace and cascades related data. Blocked on CE when it is the user's only workspace.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: "Workspace deleted",
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Cannot delete only workspace on CE",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type WorkspaceRoutesDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

function resolveDatabase(deps?: Partial<WorkspaceRoutesDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

async function requireJwtUserId(c: Context<ApiEnv>, deps: WorkspaceRoutesDependencies): Promise<string> {
  const jwtSecret = requireJwtSecret(deps.env);
  const identity = await resolveAuthIdentity(
    deps.db,
    c.req.header("Authorization"),
    jwtSecret,
  );

  if (!identity || identity.authMode !== "jwt") {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  return identity.userId;
}

function handleWorkspaceServiceError(error: unknown): never {
  if (error instanceof WorkspaceError) {
    throw new HTTPException(error.status as 400 | 403 | 404 | 409 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

/** Register workspace CRUD routes (PRD §7, pages B2/B8). */
export function registerWorkspaceRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<WorkspaceRoutesDependencies>,
): void {
  const resolveDeps = (): WorkspaceRoutesDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
  });

  registerCheckSlugRoute(app, deps?.db ? { db: deps.db } : undefined);

  app.openapi(listWorkspacesRoute, async (c) => {
    const resolved = resolveDeps();
    const userId = await requireJwtUserId(c, resolved);
    const items = await listWorkspacesForUser(resolved.db, userId);
    return c.json(items, 200);
  });

  app.openapi(createWorkspaceRoute, async (c) => {
    const resolved = resolveDeps();
    const userId = await requireJwtUserId(c, resolved);

    try {
      const workspace = await createWorkspaceSafe(resolved.db, userId, c.req.valid("json"));
      return c.json(workspace, 201);
    } catch (error) {
      handleWorkspaceServiceError(error);
    }
  });

  const scopeDeps = {
    get env() {
      return resolveDeps().env;
    },
    get db() {
      return resolveDeps().db;
    },
  };

  app.use("/api/v1/workspaces/:workspaceId", workspaceScope(scopeDeps));

  app.openapi(getWorkspaceRoute, async (c) => {
    const resolved = resolveDeps();
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const workspace = await getWorkspaceForMember(resolved.db, context.userId, workspaceId);

    if (!workspace) {
      return c.json(apiError("NOT_FOUND", "Workspace not found"), 404);
    }

    return c.json(workspace, 200);
  });

  app.openapi(patchWorkspaceRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const resolved = resolveDeps();
    const workspaceId = c.req.param("workspaceId");

    try {
      const workspace = await updateWorkspaceSafe(
        resolved.db,
        workspaceId,
        c.req.valid("json"),
      );

      if (!workspace) {
        return c.json(apiError("NOT_FOUND", "Workspace not found"), 404);
      }

      return c.json(workspace, 200);
    } catch (error) {
      handleWorkspaceServiceError(error);
    }
  });

  app.openapi(deleteWorkspaceRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "owner")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const resolved = resolveDeps();
    const workspaceId = c.req.param("workspaceId");

    try {
      await deleteWorkspace(resolved.db, context.userId, workspaceId);
      return c.body(null, 204);
    } catch (error) {
      handleWorkspaceServiceError(error);
    }
  });
}

import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { Db } from "@pipewatch/db";

import { getWorkspaceContext, roleMeetsMinimum } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import {
  listWorkspaceMembers,
  MemberError,
  removeMember,
  updateMemberRole,
} from "../../services/workspaces/member.service.js";
import type { ApiEnv } from "../../types.js";

const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);

const WorkspaceMemberSchema = z
  .object({
    user_id: z.string().uuid(),
    name: z.string().nullable().openapi({ example: "Jane Doe" }),
    email: z.string().email().nullable().openapi({ example: "jane@example.com" }),
    avatar_url: z.string().url().nullable().openapi({
      example: "https://avatars.githubusercontent.com/u/1?v=4",
    }),
    role: WorkspaceRoleSchema,
    joined_at: z.string().datetime(),
  })
  .openapi("WorkspaceMember");

const UpdateMemberBodySchema = z
  .object({
    role: WorkspaceRoleSchema,
  })
  .openapi("UpdateWorkspaceMemberBody");

const workspaceMemberParams = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});

const listMembersRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/members",
  tags: ["Workspaces"],
  summary: "List workspace members",
  description:
    "Returns accepted members with role, avatar, email, and joined date. All members have read access.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Workspace members",
      content: {
        "application/json": {
          schema: z.array(WorkspaceMemberSchema),
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
  },
});

const patchMemberRoute = createRoute({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/members/{userId}",
  tags: ["Workspaces"],
  summary: "Change a member role",
  description:
    "Updates a member role. Requires admin or owner. Cannot demote the last owner or change your own role.",
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceMemberParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateMemberBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated member",
      content: {
        "application/json": {
          schema: WorkspaceMemberSchema,
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
      description: "Member not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Cannot demote the last owner",
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

const deleteMemberRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/members/{userId}",
  tags: ["Workspaces"],
  summary: "Remove a workspace member",
  description:
    "Removes a member from the workspace. Requires admin or owner. Cannot remove the last owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceMemberParams,
  },
  responses: {
    204: {
      description: "Member removed",
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
      description: "Member not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Cannot remove the last owner",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type MemberRoutesDependencies = {
  db: Db;
};

function handleMemberServiceError(error: unknown): never {
  if (error instanceof MemberError) {
    throw new HTTPException(error.status as 403 | 404 | 409 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

/** Register workspace member routes (PRD §7, pages B9). */
export function registerMemberRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: MemberRoutesDependencies,
): void {
  app.openapi(listMembersRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const members = await listWorkspaceMembers(deps.db, workspaceId);
    return c.json(members, 200);
  });

  app.openapi(patchMemberRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const targetUserId = c.req.param("userId");

    if (targetUserId === context.userId) {
      return c.json(apiError("FORBIDDEN", "Cannot change your own role"), 403);
    }

    const workspaceId = c.req.param("workspaceId");

    try {
      const member = await updateMemberRole(
        deps.db,
        workspaceId,
        targetUserId,
        c.req.valid("json"),
      );
      return c.json(member, 200);
    } catch (error) {
      handleMemberServiceError(error);
    }
  });

  app.openapi(deleteMemberRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const workspaceId = c.req.param("workspaceId");
    const targetUserId = c.req.param("userId");

    try {
      await removeMember(deps.db, workspaceId, targetUserId);
      return c.body(null, 204);
    } catch (error) {
      handleMemberServiceError(error);
    }
  });
}

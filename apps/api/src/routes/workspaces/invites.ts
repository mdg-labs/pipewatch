import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import { getWorkspaceContext, roleMeetsMinimum } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  createWorkspaceInvite,
  InviteError,
  listWorkspaceInvites,
  resendWorkspaceInvite,
  revokeWorkspaceInvite,
} from "../../services/workspaces/invite.service.js";
import type { ApiEnv } from "../../types.js";

const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);

const WorkspaceInviteSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: WorkspaceRoleSchema,
    invited_at: z.string().datetime(),
    expires_at: z.string().datetime(),
    email_sent: z.boolean(),
    invite_url: z.string().url().optional(),
  })
  .openapi("WorkspaceInvite");

const CreateInviteBodySchema = z
  .object({
    email: z.string().trim().email().openapi({ example: "colleague@example.com" }),
    role: WorkspaceRoleSchema,
  })
  .openapi("CreateWorkspaceInviteBody");

const inviteParams = z.object({
  workspaceId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

const listInvitesRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/invites",
  tags: [OpenApiTags.INVITES],
  summary: "List pending workspace invites",
  description: "Returns pending invites for the workspace. Requires admin or owner.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Pending workspace invites",
      content: {
        "application/json": {
          schema: z.array(WorkspaceInviteSchema),
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
  },
});

const createInviteRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/invites",
  tags: [OpenApiTags.INVITES],
  summary: "Invite a workspace member",
  description:
    "Creates a 7-day invite and sends email via SMTP when configured. Returns invite_url when SMTP is unset.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateInviteBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created invite",
      content: {
        "application/json": {
          schema: WorkspaceInviteSchema,
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
    409: {
      description: "Invite conflict",
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

const deleteInviteRoute = createRoute({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/invites/{inviteId}",
  tags: [OpenApiTags.INVITES],
  summary: "Revoke a pending invite",
  security: [{ bearerAuth: [] }],
  request: {
    params: inviteParams,
  },
  responses: {
    204: {
      description: "Invite revoked",
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
      description: "Invite not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const resendInviteRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/invites/{inviteId}/resend",
  tags: [OpenApiTags.INVITES],
  summary: "Resend a workspace invite",
  description:
    "Re-sends the invite email via SMTP when configured. Returns invite_url when SMTP is unset.",
  security: [{ bearerAuth: [] }],
  request: {
    params: inviteParams,
  },
  responses: {
    200: {
      description: "Invite resent",
      content: {
        "application/json": {
          schema: WorkspaceInviteSchema,
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
      description: "Invite not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Invite already accepted",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    410: {
      description: "Invite expired",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type InviteRoutesDependencies = {
  env: ParsedApiEnv;
  db: Db;
};

function handleInviteServiceError(error: unknown): never {
  if (error instanceof InviteError) {
    throw new HTTPException(error.status as 403 | 404 | 409 | 410 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

/** Register workspace invite routes (PRD §7, §21, pages B9). */
export function registerInviteRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps: InviteRoutesDependencies,
): void {
  app.openapi(listInvitesRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const workspaceId = c.req.param("workspaceId");
    const invites = await listWorkspaceInvites(deps.db, workspaceId);
    return c.json(invites, 200);
  });

  app.openapi(createInviteRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const workspaceId = c.req.param("workspaceId");

    try {
      const invite = await createWorkspaceInvite(
        deps.db,
        deps.env,
        workspaceId,
        context.userId,
        c.req.valid("json"),
      );
      return c.json(invite, 201);
    } catch (error) {
      handleInviteServiceError(error);
    }
  });

  app.openapi(deleteInviteRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const workspaceId = c.req.param("workspaceId");
    const inviteId = c.req.param("inviteId");

    try {
      await revokeWorkspaceInvite(deps.db, workspaceId, inviteId);
      return c.body(null, 204);
    } catch (error) {
      handleInviteServiceError(error);
    }
  });

  app.openapi(resendInviteRoute, async (c) => {
    const context = getWorkspaceContext(c);

    if (!context) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!roleMeetsMinimum(context.role, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const workspaceId = c.req.param("workspaceId");
    const inviteId = c.req.param("inviteId");

    try {
      const invite = await resendWorkspaceInvite(deps.db, deps.env, workspaceId, inviteId);
      return c.json(invite, 200);
    } catch (error) {
      handleInviteServiceError(error);
    }
  });
}

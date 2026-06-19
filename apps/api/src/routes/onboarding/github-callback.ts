import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import {
  loadWorkspaceMembership,
  parseBearerToken,
  resolveJwtAuthIdentity,
  roleMeetsMinimum,
} from "../../lib/workspace-context.js";
import {
  ApiErrorEnvelopeSchema,
  apiError,
  logUnhandledRequestError,
} from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import {
  processGitHubInstallCallback,
  resolveInstallCallbackFailure,
  type EnqueueBackfillIntegration,
  type InstallCallbackDeps,
} from "../../services/integrations/install-callback.js";
import { createE2eGitHubFetch, isE2eMockEnabled } from "../../testing/e2e-mock.js";
import type { ApiEnv } from "../../types.js";
import { ACCESS_COOKIE_NAME, requireJwtSecret } from "../auth/shared.js";

const githubCallbackRoute = createRoute({
  method: "get",
  path: "/onboarding/github-callback",
  tags: [OpenApiTags.ONBOARDING],
  summary: "GitHub App install callback",
  description:
    "Accepts GitHub `installation_id` after App install (or CE manual entry), upserts the integration, enqueues backfill, and redirects to onboarding step 3 (PRD §12.1, pages B17).",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      installation_id: z.string().trim().min(1).openapi({
        example: "12345678",
        description: "GitHub App installation ID from the install redirect or CE manual entry",
      }),
    }),
  },
  responses: {
    302: {
      description: "Redirect to onboarding step 3",
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
      description: "Insufficient permissions or missing workspace context",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "GitHub installation not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    409: {
      description: "Installation already connected to another workspace",
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
    502: {
      description: "Upstream GitHub or queue error",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    503: {
      description: "Service unavailable",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type GitHubInstallCallbackDependencies = {
  env: ParsedApiEnv;
  db: Db;
  fetchImpl?: typeof fetch;
  enqueueBackfill?: EnqueueBackfillIntegration;
};

function resolveDatabase(deps?: Partial<GitHubInstallCallbackDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

function resolveAccessToken(c: Context): string | undefined {
  const bearer = parseBearerToken(c.req.header("Authorization"));
  if (bearer) {
    return bearer;
  }

  return getCookie(c, ACCESS_COOKIE_NAME);
}

function onboardingStep3Url(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/onboarding?step=3`;
}

function requireAppUrl(env: ParsedApiEnv): string {
  const appUrl = env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not configured");
  }

  return appUrl;
}

type CallbackErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 502 | 503;

/** Register GitHub App install callback (pages B17, B2 step 2). */
export function registerGitHubInstallCallbackRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<GitHubInstallCallbackDependencies>,
): void {
  const resolveDeps = (): GitHubInstallCallbackDependencies => {
    const env = deps?.env ?? parseApiEnv();

    return {
      env,
      db: resolveDatabase(deps),
      ...(deps?.fetchImpl
        ? { fetchImpl: deps.fetchImpl }
        : isE2eMockEnabled(env)
          ? { fetchImpl: createE2eGitHubFetch() }
          : {}),
      ...(deps?.enqueueBackfill
        ? { enqueueBackfill: deps.enqueueBackfill }
        : isE2eMockEnabled(env)
          ? { enqueueBackfill: async () => undefined }
          : {}),
    };
  };

  app.openapi(githubCallbackRoute, async (c) => {
    const resolved = resolveDeps();
    const jwtSecret = requireJwtSecret(resolved.env);
    const accessToken = resolveAccessToken(c);

    if (!accessToken) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    const identity = await resolveJwtAuthIdentity(accessToken, jwtSecret);
    if (!identity) {
      return c.json(apiError("UNAUTHORIZED", "Authentication required"), 401);
    }

    if (!identity.workspaceId) {
      return c.json(
        apiError("FORBIDDEN", "Select a workspace before connecting GitHub"),
        403,
      );
    }

    const membershipRole = await loadWorkspaceMembership(
      resolved.db,
      identity.workspaceId,
      identity.userId,
    );

    if (!membershipRole) {
      return c.json(apiError("FORBIDDEN", "Not a member of this workspace"), 403);
    }

    if (!roleMeetsMinimum(membershipRole, "admin")) {
      return c.json(apiError("FORBIDDEN", "Insufficient workspace permissions"), 403);
    }

    const { installation_id: installationId } = c.req.valid("query");

    const callbackDeps: InstallCallbackDeps = {
      ...(resolved.fetchImpl ? { fetchImpl: resolved.fetchImpl } : {}),
      ...(resolved.enqueueBackfill ? { enqueueBackfill: resolved.enqueueBackfill } : {}),
    };

    try {
      await processGitHubInstallCallback(
        resolved.db,
        resolved.env,
        identity.workspaceId,
        installationId,
        callbackDeps,
      );
    } catch (error) {
      const failure = resolveInstallCallbackFailure(error);
      if (failure) {
        return c.json(
          apiError(failure.code, failure.message),
          failure.status as CallbackErrorStatus,
        );
      }

      logUnhandledRequestError(c.get("requestId") ?? "unknown", error);
      throw error;
    }

    return c.redirect(onboardingStep3Url(requireAppUrl(resolved.env)), 302);
  });
}

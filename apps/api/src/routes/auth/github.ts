import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";

import { buildOAuthCallbackUrl } from "../../lib/api-public-url.js";
import { ApiErrorEnvelopeSchema } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from "../../services/auth/jwt.js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  buildAuthCookieOptions,
  generateRefreshTokenValue,
  storeRefreshToken,
} from "../../services/auth/refresh-token.js";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAuthError,
  bootstrapCeWorkspace,
  buildGitHubAuthorizeUrl,
  countUsers,
  createGitHubOAuthClient,
  createOAuthState,
  listUserWorkspaces,
  requireOAuthConfig,
  resolveAuthSession,
  resolvePostAuthRedirect,
  upsertGitHubUser,
  verifyOAuthState,
  type GitHubOAuthClient,
} from "../../services/auth/oauth.js";
import { resolveOAuthClient } from "../../testing/e2e-mock.js";
import { sendEmail } from "../../services/email/send-email.js";
import { renderWelcomeEmail } from "../../services/email/templates/welcome.js";
import type { ApiEnv } from "../../types.js";

export type GitHubAuthDependencies = {
  env: ParsedApiEnv;
  db: Db;
  oauthClient: GitHubOAuthClient;
  sendEmailFn?: typeof sendEmail;
};

const githubInitRoute = createRoute({
  method: "get",
  path: "/auth/github",
  tags: [OpenApiTags.AUTH],
  summary: "Initiate GitHub OAuth",
  description:
    "Redirects the browser to GitHub authorization. Optional `next` query param is preserved for post-auth redirect.",
  request: {
    query: z.object({
      next: z.string().optional().openapi({
        description: "Relative or absolute post-auth redirect target",
        example: "/dashboard",
      }),
    }),
  },
  responses: {
    302: {
      description: "Redirect to GitHub OAuth authorization",
    },
  },
});

const githubCallbackRoute = createRoute({
  method: "get",
  path: "/auth/github/callback",
  tags: [OpenApiTags.AUTH],
  summary: "GitHub OAuth callback",
  description:
    "Exchanges the authorization code, upserts the user, issues JWT + refresh cookies, and redirects to the app.",
  request: {
    query: z.object({
      code: z.string().openapi({ example: "gho_authorization_code" }),
      state: z.string().openapi({ example: "signed-oauth-state" }),
    }),
  },
  responses: {
    302: {
      description: "Redirect to app after successful sign-in",
    },
    400: {
      description: "Invalid or missing OAuth parameters",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    401: {
      description: "OAuth state validation failed",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    502: {
      description: "GitHub token exchange failed",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

function resolveSecureCookies(env: ParsedApiEnv): boolean {
  return env.NODE_ENV !== "development";
}

function clearOAuthStateCookie(c: Context, secure: boolean): void {
  setCookie(c, OAUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "Strict",
    path: "/auth/github",
    maxAge: 0,
  });
}

function resolveDatabase(deps?: Partial<GitHubAuthDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

/** Register GitHub OAuth initiate + callback routes (PRD §7.1, §20). */
export function registerGitHubAuthRoutes(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<GitHubAuthDependencies>,
): void {
  const resolveDeps = (): GitHubAuthDependencies => {
    const env = deps?.env ?? parseApiEnv();

    return {
      env,
      db: resolveDatabase(deps),
      oauthClient: resolveOAuthClient(
        env,
        deps?.oauthClient ??
          createGitHubOAuthClient({
            clientId: env.GITHUB_CLIENT_ID ?? "",
            clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
          }),
      ),
    };
  };

  app.openapi(githubInitRoute, (c) => {
    const { env } = resolveDeps();
    const config = requireOAuthConfig(env);
    const { next } = c.req.valid("query");
    const { state, cookieValue } = createOAuthState(config.refreshSecret, next);
    const redirectUri = buildOAuthCallbackUrl(env, c.req.url, {
      get: (name) => c.req.header(name),
    });
    const authorizeUrl = buildGitHubAuthorizeUrl(config.clientId, redirectUri, state);
    const secure = resolveSecureCookies(env);

    setCookie(c, OAUTH_STATE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure,
      sameSite: "Strict",
      path: "/auth/github",
      maxAge: 10 * 60,
    });

    return c.redirect(authorizeUrl, 302);
  });

  app.openapi(githubCallbackRoute, async (c) => {
    const { env, db, oauthClient } = resolveDeps();
    const secure = resolveSecureCookies(env);

    try {
      const config = requireOAuthConfig(env);
      const { code, state } = c.req.valid("query");
      const stateCookie = getCookie(c, OAUTH_STATE_COOKIE_NAME);

      if (!code || !state) {
        throw new OAuthError("Missing OAuth callback parameters", 400);
      }

      const oauthState = verifyOAuthState(config.refreshSecret, state, stateCookie);

      const redirectUri = buildOAuthCallbackUrl(env, c.req.url, {
        get: (name) => c.req.header(name),
      });
      const profile = await oauthClient.exchangeCode(code, redirectUri);
      const wasFirstUser = (await countUsers(db)) === 0;
      const upserted = await upsertGitHubUser(db, profile, wasFirstUser);

      if (upserted.isNew && upserted.user.email) {
        const welcome = renderWelcomeEmail({
          recipientName: upserted.user.name,
          appUrl: config.appUrl,
        });
        const deliverWelcome = deps?.sendEmailFn ?? sendEmail;
        void deliverWelcome(env, {
          to: upserted.user.email,
          ...welcome,
        }).catch(() => undefined);
      }

      let bootstrapWorkspace = null;
      if (upserted.wasFirstUser && upserted.isNew) {
        bootstrapWorkspace = await bootstrapCeWorkspace(db, upserted.user.id);
      }

      const memberships = await listUserWorkspaces(db, upserted.user.id);
      const session = await resolveAuthSession(db, upserted.user.id, bootstrapWorkspace);

      const accessToken = await signAccessToken(
        {
          userId: session.user.id,
          ...(session.workspace && session.membershipRole
            ? {
                workspaceId: session.workspace.id,
                role: session.membershipRole,
              }
            : {}),
        },
        config.jwtSecret,
      );

      const refreshToken = generateRefreshTokenValue();
      await storeRefreshToken(db, session.user.id, refreshToken);

      const refreshCookie = buildAuthCookieOptions(secure);

      setCookie(c, REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: refreshCookie.secure,
        sameSite: "Strict",
        path: refreshCookie.path,
        maxAge: refreshCookie.maxAgeSeconds,
      });

      setCookie(c, ACCESS_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure,
        sameSite: "Strict",
        path: "/",
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
      });

      clearOAuthStateCookie(c, secure);

      const location = resolvePostAuthRedirect({
        appUrl: config.appUrl,
        ...(oauthState.next !== undefined ? { next: oauthState.next } : {}),
        wasFirstUser: upserted.wasFirstUser,
        bootstrapWorkspace,
        memberships,
      });

      return c.redirect(location, 302);
    } catch (error) {
      clearOAuthStateCookie(c, secure);

      if (error instanceof OAuthError) {
        throw new HTTPException(error.status as 400 | 401 | 403 | 404 | 502 | 503, {
          message: error.message,
        });
      }

      throw error;
    }
  });
}

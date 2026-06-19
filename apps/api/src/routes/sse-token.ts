import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Redis } from "ioredis";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";

import { resolveRedisClient } from "../lib/redis-client.js";
import { parseBearerToken, resolveJwtAuthIdentity } from "../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../middleware/error-handler.js";
import type { RateLimitDependencies } from "../middleware/rate-limit.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import { OpenApiTags } from "../openapi-tags.js";
import { createSseToken } from "../services/sse-token.js";
import type { ApiEnv } from "../types.js";
import { requireJwtSecret } from "./auth/shared.js";

const SseTokenResponseSchema = z
  .object({
    token: z.string().openapi({ example: "dGhpcyBpcyBhIG9uZS10aW1lIHRva2Vu" }),
    expiresIn: z.number().int().openapi({ example: 60 }),
  })
  .openapi("SseTokenResponse");

const getSseTokenRoute = createRoute({
  method: "get",
  path: "/api/v1/sse-token",
  tags: [OpenApiTags.SSE],
  summary: "Issue one-time SSE token",
  description:
    "Returns a short-lived one-time token for SSE stream authentication via query parameter.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "One-time SSE token",
      content: {
        "application/json": {
          schema: SseTokenResponseSchema,
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
    503: {
      description: "SSE token service unavailable",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type SseTokenDependencies = {
  env: ParsedApiEnv;
  redis?: Redis;
  rateLimit?: Partial<RateLimitDependencies>;
};

async function requireJwtIdentity(
  c: Context<ApiEnv>,
  deps: SseTokenDependencies,
): Promise<{ userId: string; workspaceId?: string }> {
  const jwtSecret = requireJwtSecret(deps.env);
  const token = parseBearerToken(c.req.header("Authorization"));

  if (!token) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  const identity = await resolveJwtAuthIdentity(token, jwtSecret);

  if (!identity) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  return {
    userId: identity.userId,
    ...(identity.workspaceId !== undefined ? { workspaceId: identity.workspaceId } : {}),
  };
}

/** Register SSE one-time token route (PRD §19, pages B22). */
export function registerSseTokenRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<SseTokenDependencies>,
): void {
  const rateLimitDeps =
    deps?.rateLimit ??
    (deps?.env
      ? {
          env: deps.env,
          ...(deps.redis !== undefined ? { redis: deps.redis } : {}),
        }
      : undefined);
  app.use("/api/v1/sse-token", createRateLimitMiddleware("sseToken", rateLimitDeps));

  const resolveDeps = (): SseTokenDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    ...(deps?.redis !== undefined ? { redis: deps.redis } : {}),
  });

  app.openapi(getSseTokenRoute, async (c) => {
    const resolved = resolveDeps();
    const redisUrl = resolved.env.REDIS_URL;

    if (!redisUrl) {
      return c.json(apiError("SERVICE_UNAVAILABLE", "SSE token service unavailable"), 503);
    }

    const identity = await requireJwtIdentity(c, resolved);
    const redis = resolveRedisClient(redisUrl, resolved.redis);
    const result = await createSseToken(redis, identity);

    return c.json(result, 200);
  });
}

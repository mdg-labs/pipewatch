import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import { Redis } from "ioredis";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { getDb } from "@pipewatch/db";

import { loadWorkspaceMembership } from "../../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../../middleware/error-handler.js";
import { getWorkspaceRepository } from "../../../services/repositories/repository.service.js";
import {
  createHeartbeatEvent,
  SSE_HEARTBEAT_INTERVAL_MS,
  subscribeSseBroadcaster,
} from "../../../services/sse-broadcaster.js";
import { consumeSseToken } from "../../../services/sse-token.js";
import type { ApiEnv } from "../../../types.js";

const streamParams = z.object({
  workspaceId: z.string().uuid(),
  repoId: z.string().uuid(),
});

const streamQuery = z.object({
  token: z.string().min(1).openapi({ description: "One-time SSE token from GET /api/v1/sse-token" }),
});

const streamRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/repos/{repoId}/stream",
  tags: ["SSE"],
  summary: "SSE stream for repository pipeline updates",
  description:
    "Server-sent events for run and job updates. Authenticated via one-time query token (PRD §19, page B22).",
  request: {
    params: streamParams,
    query: streamQuery,
  },
  responses: {
    200: {
      description: "SSE event stream",
      content: {
        "text/event-stream": {
          schema: z.string().openapi({ description: "SSE data lines with JSON event payloads" }),
        },
      },
    },
    401: {
      description: "Invalid or expired SSE token",
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
      description: "Repository not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    503: {
      description: "SSE stream unavailable",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type StreamRouteDependencies = {
  env: ParsedApiEnv;
  db: Db;
  redis?: Redis;
};

let sharedRedisClient: Redis | null = null;
let sharedRedisUrl: string | null = null;

function resolveRedisClient(redisUrl: string, override?: Redis): Redis {
  if (override) {
    return override;
  }

  if (sharedRedisClient && sharedRedisUrl === redisUrl) {
    return sharedRedisClient;
  }

  if (sharedRedisClient) {
    void sharedRedisClient.quit();
  }

  sharedRedisClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
  sharedRedisUrl = redisUrl;
  return sharedRedisClient;
}

function resolveDatabase(deps?: Partial<StreamRouteDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

/** Register repo SSE stream route — token auth, no Bearer header (PRD §19). */
export function registerStreamRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<StreamRouteDependencies>,
): void {
  const resolveDeps = (): StreamRouteDependencies => ({
    env: deps?.env ?? parseApiEnv(),
    db: resolveDatabase(deps),
    ...(deps?.redis !== undefined ? { redis: deps.redis } : {}),
  });

  app.openapi(streamRoute, async (c) => {
    const resolved = resolveDeps();
    const redisUrl = resolved.env.REDIS_URL;

    if (!redisUrl) {
      return c.json(apiError("SERVICE_UNAVAILABLE", "SSE stream unavailable"), 503);
    }

    const { workspaceId, repoId } = c.req.valid("param");
    const { token } = c.req.valid("query");
    const redis = resolveRedisClient(redisUrl, resolved.redis);

    const tokenPayload = await consumeSseToken(redis, token);
    if (!tokenPayload) {
      return c.json(apiError("UNAUTHORIZED", "Invalid or expired SSE token"), 401);
    }

    if (tokenPayload.workspaceId !== undefined && tokenPayload.workspaceId !== workspaceId) {
      return c.json(apiError("FORBIDDEN", "SSE token is not valid for this workspace"), 403);
    }

    const membership = await loadWorkspaceMembership(
      resolved.db,
      workspaceId,
      tokenPayload.userId,
    );

    if (!membership) {
      return c.json(apiError("FORBIDDEN", "Access to this workspace is forbidden"), 403);
    }

    const repository = await getWorkspaceRepository(resolved.db, workspaceId, repoId);
    if (!repository) {
      return c.json(apiError("NOT_FOUND", "Repository not found"), 404);
    }

    const signal = c.req.raw.signal;

    return streamSSE(c, async (stream) => {
      const broadcaster = await subscribeSseBroadcaster({
        redis,
        workspaceId,
        repoId,
        signal,
        onEvent: async (event) => {
          await stream.writeSSE({
            data: JSON.stringify(event),
          });
        },
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({
          data: JSON.stringify(createHeartbeatEvent()),
        });
      }, SSE_HEARTBEAT_INTERVAL_MS);

      await waitForAbort(signal);

      clearInterval(heartbeat);
      await broadcaster.cleanup();
    });
  });
}

import type { Context, MiddlewareHandler } from "hono";
import type { Redis } from "ioredis";

import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";

import { resolveRedisClient } from "../lib/redis-client.js";
import { apiError } from "./error-handler.js";
import type { ApiEnv } from "../types.js";

export type RateLimitConfig = {
  max: number;
  windowSeconds: number;
};

/** Per-IP rate limit defaults (PRD §15). */
export const RATE_LIMIT_DEFAULTS = {
  auth: { max: 20, windowSeconds: 60 },
  refresh: { max: 30, windowSeconds: 60 },
  waitlist: { max: 5, windowSeconds: 60 },
  invite: { max: 30, windowSeconds: 60 },
  sseToken: { max: 120, windowSeconds: 60 },
  webhook: { max: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitBucket = keyof typeof RATE_LIMIT_DEFAULTS;

export type RateLimitResult =
  | { allowed: true; remaining: number; resetInSeconds: number }
  | { allowed: false; retryAfterSeconds: number };

const RATE_LIMIT_KEY_PREFIX = "pw:rl:";

const incrementScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  ttl = tonumber(ARGV[1])
end
if current > tonumber(ARGV[2]) then
  return {0, ttl}
end
return {1, tonumber(ARGV[2]) - current, ttl}
`;

/** Resolve the client IP from proxy headers or fall back to a sentinel. */
export function resolveClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function buildRateLimitKey(bucket: RateLimitBucket, ip: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${bucket}:${ip}`;
}

/** Check and increment a fixed-window per-IP counter in Redis. */
export async function checkRateLimit(
  redis: Redis,
  bucket: RateLimitBucket,
  ip: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = buildRateLimitKey(bucket, ip);
  const response = (await redis.eval(
    incrementScript,
    1,
    key,
    String(config.windowSeconds),
    String(config.max),
  )) as [number, number, number];

  const allowed = response[0] === 1;
  if (allowed) {
    return {
      allowed: true,
      remaining: response[1],
      resetInSeconds: response[2],
    };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, response[1]),
  };
}

export type RateLimitDependencies = {
  env?: Pick<ParsedApiEnv, "REDIS_URL">;
  redis?: Redis;
  config?: RateLimitConfig;
  /** Skip rate limiting (integration tests that exercise other behaviour). */
  disabled?: boolean;
};

function resolveRateLimitConfig(
  bucket: RateLimitBucket,
  override?: RateLimitConfig,
): RateLimitConfig {
  return override ?? RATE_LIMIT_DEFAULTS[bucket];
}

function resolveRedisUrl(deps?: Partial<RateLimitDependencies>): string | undefined {
  const fromDeps = deps?.env?.REDIS_URL;
  if (fromDeps) {
    return fromDeps;
  }

  return process.env.REDIS_URL;
}

function rateLimitExceededResponse(c: Context, retryAfterSeconds: number): Response {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json(apiError("RATE_LIMITED", "Too many requests"), 429);
}

/**
 * Enforce a rate limit inside a route handler (e.g. webhooks after HMAC verification).
 * Returns a 429 response when exceeded, otherwise null.
 */
export async function enforceRateLimit(
  c: Context<ApiEnv>,
  bucket: RateLimitBucket,
  deps?: Partial<RateLimitDependencies>,
): Promise<Response | null> {
  if (deps?.disabled) {
    return null;
  }

  const redisUrl = resolveRedisUrl(deps);

  if (!redisUrl) {
    return null;
  }

  const config = resolveRateLimitConfig(bucket, deps?.config);

  try {
    const redis = resolveRedisClient(redisUrl, deps?.redis);
    const ip = resolveClientIp(c);
    const result = await checkRateLimit(redis, bucket, ip, config);

    if (!result.allowed) {
      return rateLimitExceededResponse(c, result.retryAfterSeconds);
    }
  } catch {
    return null;
  }

  return null;
}

/** Hono middleware factory for per-IP Redis-backed rate limiting. */
export function createRateLimitMiddleware(
  bucket: RateLimitBucket,
  deps?: Partial<RateLimitDependencies>,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const blocked = await enforceRateLimit(c, bucket, deps);
    if (blocked) {
      return blocked;
    }

    await next();
  };
}

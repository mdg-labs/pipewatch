import type { Context } from "hono";
import { Redis, type Redis as RedisClient } from "ioredis";

import type { AdminEnv } from "@pipewatch/config/env";

import { apiError } from "../lib/api-error.js";

type RateLimitConfig = {
  max: number;
  windowSeconds: number;
};

const FORGOT_PASSWORD_IP_LIMIT: RateLimitConfig = { max: 10, windowSeconds: 3600 };
const FORGOT_PASSWORD_EMAIL_LIMIT: RateLimitConfig = { max: 3, windowSeconds: 3600 };

const KEY_PREFIX = "pw:admin:rl:forgot:";

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

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type MemoryBucket = {
  count: number;
  expiresAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();

let sharedRedis: RedisClient | undefined;

function resolveClientIp(c: Context): string {
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveRedis(redisUrl: string | undefined, override?: RedisClient): RedisClient | undefined {
  if (override) {
    return override;
  }

  if (!redisUrl) {
    return undefined;
  }

  if (!sharedRedis) {
    sharedRedis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  }

  return sharedRedis;
}

async function checkRedisLimit(
  redis: RedisClient,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const response = (await redis.eval(
    incrementScript,
    1,
    key,
    String(config.windowSeconds),
    String(config.max),
  )) as [number, number, number];

  if (response[0] === 1) {
    return { allowed: true };
  }

  return { allowed: false, retryAfterSeconds: Math.max(1, response[1]) };
}

function checkMemoryLimit(key: string, config: RateLimitConfig, now: number): RateLimitResult {
  const existing = memoryBuckets.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryBuckets.set(key, {
      count: 1,
      expiresAt: now + config.windowSeconds * 1000,
    });
    return { allowed: true };
  }

  existing.count += 1;
  if (existing.count > config.max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }

  return { allowed: true };
}

async function checkLimit(
  key: string,
  config: RateLimitConfig,
  redis: RedisClient | undefined,
  now: number,
): Promise<RateLimitResult> {
  if (redis) {
    try {
      if (redis.status !== "ready") {
        await redis.connect();
      }
      return await checkRedisLimit(redis, key, config);
    } catch {
      return checkMemoryLimit(key, config, now);
    }
  }

  return checkMemoryLimit(key, config, now);
}

export type ForgotPasswordRateLimitDeps = {
  env?: Pick<AdminEnv, "REDIS_URL">;
  redis?: RedisClient;
  disabled?: boolean;
};

function rateLimitExceededResponse(c: Context, retryAfterSeconds: number): Response {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json(apiError("RATE_LIMITED", "Too many requests"), 429);
}

/** Enforce per-IP and per-email rate limits for forgot-password requests. */
export async function enforceForgotPasswordRateLimit(
  c: Context,
  email: string,
  deps?: ForgotPasswordRateLimitDeps,
): Promise<Response | null> {
  if (deps?.disabled) {
    return null;
  }

  const now = Date.now();
  const redis = resolveRedis(deps?.env?.REDIS_URL ?? process.env.REDIS_URL, deps?.redis);
  const ip = resolveClientIp(c);
  const normalizedEmail = normalizeEmail(email);

  const ipResult = await checkLimit(
    `${KEY_PREFIX}ip:${ip}`,
    FORGOT_PASSWORD_IP_LIMIT,
    redis,
    now,
  );
  if (!ipResult.allowed) {
    return rateLimitExceededResponse(c, ipResult.retryAfterSeconds);
  }

  const emailResult = await checkLimit(
    `${KEY_PREFIX}email:${normalizedEmail}`,
    FORGOT_PASSWORD_EMAIL_LIMIT,
    redis,
    now,
  );
  if (!emailResult.allowed) {
    return rateLimitExceededResponse(c, emailResult.retryAfterSeconds);
  }

  return null;
}

/** Reset in-memory buckets between tests. */
export function resetForgotPasswordRateLimitMemory(): void {
  memoryBuckets.clear();
}

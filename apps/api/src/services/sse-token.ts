import { randomBytes } from "node:crypto";

import type { Redis } from "ioredis";

export const SSE_TOKEN_TTL_SECONDS = 60;
export const SSE_TOKEN_KEY_PREFIX = "sse:token:";

export type SseTokenPayload = {
  userId: string;
  workspaceId?: string;
};

export type SseTokenResponse = {
  token: string;
  expiresIn: number;
};

/** Issue a one-time SSE query token stored in Redis (PRD §19). */
export async function createSseToken(
  redis: Redis,
  payload: SseTokenPayload,
): Promise<SseTokenResponse> {
  const token = randomBytes(32).toString("base64url");
  const key = `${SSE_TOKEN_KEY_PREFIX}${token}`;

  await redis.set(key, JSON.stringify(payload), "EX", SSE_TOKEN_TTL_SECONDS);

  return {
    token,
    expiresIn: SSE_TOKEN_TTL_SECONDS,
  };
}

/** Validate and consume a one-time SSE token — deletes the Redis key atomically. */
export async function consumeSseToken(
  redis: Redis,
  token: string,
): Promise<SseTokenPayload | null> {
  const key = `${SSE_TOKEN_KEY_PREFIX}${token}`;
  const results = await redis
    .multi()
    .get(key)
    .del(key)
    .exec();

  const value = results?.[0]?.[1];
  if (typeof value !== "string") {
    return null;
  }

  return JSON.parse(value) as SseTokenPayload;
}

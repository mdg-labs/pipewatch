import type { ConnectionOptions } from "bullmq";

/** BullMQ Redis connection — `maxRetriesPerRequest` must be null for Workers. */
export function createRedisConnection(redisUrl: string): ConnectionOptions {
  return {
    url: redisUrl,
    maxRetriesPerRequest: null,
  };
}

/** Resolve Redis URL from admin env — required for queue operations. */
export function resolveRedisUrl(redisUrl: string | undefined): string {
  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }

  return redisUrl;
}

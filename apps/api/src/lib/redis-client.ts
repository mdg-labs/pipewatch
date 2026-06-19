import { Redis } from "ioredis";

let sharedRedisClient: Redis | null = null;
let sharedRedisUrl: string | null = null;

/** Return a process-scoped Redis client for the given URL (tests may inject an override). */
export function resolveRedisClient(redisUrl: string, override?: Redis): Redis {
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

/** Close the shared Redis client (integration test teardown). */
export async function closeSharedRedisClient(): Promise<void> {
  if (sharedRedisClient) {
    await sharedRedisClient.quit();
    sharedRedisClient = null;
    sharedRedisUrl = null;
  }
}

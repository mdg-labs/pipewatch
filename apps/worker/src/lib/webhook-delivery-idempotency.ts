import { Redis } from "ioredis";

const DELIVERY_SSE_KEY_PREFIX = "pw:webhook:delivery:";
const DELIVERY_ENQUEUE_KEY_PREFIX = "pw:webhook:delivery:enqueue:";
const DELIVERY_TTL_SECONDS = 86_400;

let sharedRedis: Redis | null = null;
let sharedRedisUrl: string | null = null;

function resolveRedis(redisUrl: string): Redis {
  if (sharedRedis && sharedRedisUrl === redisUrl) {
    return sharedRedis;
  }

  if (sharedRedis) {
    void sharedRedis.quit();
  }

  sharedRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  sharedRedisUrl = redisUrl;
  return sharedRedis;
}

async function claimDeliveryKey(
  keyPrefix: string,
  deliveryId: string,
  redisUrl: string,
): Promise<boolean> {
  const redis = resolveRedis(redisUrl);
  const result = await redis.set(
    `${keyPrefix}${deliveryId}`,
    "1",
    "EX",
    DELIVERY_TTL_SECONDS,
    "NX",
  );

  return result === "OK";
}

/**
 * Claim a GitHub `X-GitHub-Delivery` id for webhook enqueue.
 * Returns `true` when a job should be enqueued; `false` for duplicate deliveries within TTL.
 */
export async function claimWebhookDeliveryForEnqueue(
  deliveryId: string | undefined,
  redisUrl: string | undefined,
): Promise<boolean> {
  if (!deliveryId || !redisUrl) {
    return true;
  }

  return claimDeliveryKey(DELIVERY_ENQUEUE_KEY_PREFIX, deliveryId, redisUrl);
}

/**
 * Claim a GitHub `X-GitHub-Delivery` id for SSE publishing.
 * Returns `true` when SSE should be published; `false` when this delivery was already processed.
 */
export async function claimWebhookDeliveryForSse(
  deliveryId: string | undefined,
  redisUrl: string | undefined,
): Promise<boolean> {
  if (!deliveryId || !redisUrl) {
    return true;
  }

  return claimDeliveryKey(DELIVERY_SSE_KEY_PREFIX, deliveryId, redisUrl);
}

/** Test teardown helper — closes the shared Redis client when present. */
export async function closeWebhookDeliveryRedis(): Promise<void> {
  if (!sharedRedis) {
    return;
  }

  await sharedRedis.quit();
  sharedRedis = null;
  sharedRedisUrl = null;
}

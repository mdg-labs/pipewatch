import { Queue } from "bullmq";

import { createRedisConnection } from "./connection.js";

export const ADMIN_QUEUE_NAMES = {
  WEBHOOK_POLL: "admin-webhook-poll",
  MAINTENANCE: "admin-maintenance",
} as const;

export type AdminQueueName =
  (typeof ADMIN_QUEUE_NAMES)[keyof typeof ADMIN_QUEUE_NAMES];

const WEBHOOK_POLL_RETRY = {
  attempts: 3,
  backoffDelaysMs: [5000, 30_000, 120_000] as const,
  priority: 5,
};

const queues = new Map<string, Queue>();

function createQueue(name: AdminQueueName, redisUrl: string): Queue {
  return new Queue(name, {
    connection: createRedisConnection(redisUrl),
    defaultJobOptions: {
      attempts: WEBHOOK_POLL_RETRY.attempts,
      backoff: { type: "custom" },
      priority: WEBHOOK_POLL_RETRY.priority,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
}

/** Lazily resolve a named admin queue using the shared Redis connection config. */
export function getAdminQueue(name: AdminQueueName, redisUrl: string): Queue {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  const queue = createQueue(name, redisUrl);
  queues.set(name, queue);
  return queue;
}

/** Custom backoff delay for admin queues after `attemptsMade` failures (1-based). */
export function resolveAdminBackoffDelay(attemptsMade: number): number {
  const { backoffDelaysMs } = WEBHOOK_POLL_RETRY;
  const index = attemptsMade - 1;
  const fallback = backoffDelaysMs[backoffDelaysMs.length - 1] ?? 5000;
  return backoffDelaysMs[index] ?? fallback;
}

/** Default job options for admin enqueue helpers. */
export function defaultAdminJobOptions() {
  return {
    attempts: WEBHOOK_POLL_RETRY.attempts,
    backoff: { type: "custom" as const },
    priority: WEBHOOK_POLL_RETRY.priority,
  };
}

/** Close all cached queue instances — test teardown helper. */
export async function closeAllAdminQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}

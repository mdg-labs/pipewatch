import { Queue } from "bullmq";

import { createRedisConnection } from "./connection.js";

export const QUEUE_NAMES = {
  WEBHOOK_EVENTS: "webhook-events",
  BACKFILL: "backfill",
  POLLING: "polling",
  MAINTENANCE: "maintenance",
  DEAD_LETTER: "dead-letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type QueueRetryConfig = {
  attempts: number;
  backoffDelaysMs: readonly number[];
  priority: number;
};

/** Retry/backoff per PRD §18 — custom delay arrays per queue. */
export const QUEUE_RETRY_CONFIG: Record<
  Exclude<QueueName, typeof QUEUE_NAMES.DEAD_LETTER>,
  QueueRetryConfig
> = {
  [QUEUE_NAMES.WEBHOOK_EVENTS]: {
    attempts: 3,
    backoffDelaysMs: [1000, 5000, 30_000],
    priority: 10,
  },
  [QUEUE_NAMES.BACKFILL]: {
    attempts: 5,
    backoffDelaysMs: [5000, 30_000, 120_000, 600_000, 1_800_000],
    priority: 1,
  },
  [QUEUE_NAMES.POLLING]: {
    attempts: 3,
    backoffDelaysMs: [5000, 30_000, 120_000],
    priority: 5,
  },
  [QUEUE_NAMES.MAINTENANCE]: {
    attempts: 3,
    backoffDelaysMs: [5000, 30_000, 120_000],
    priority: 1,
  },
};

const queues = new Map<string, Queue>();

function createQueue(name: QueueName, redisUrl: string): Queue {
  if (name === QUEUE_NAMES.DEAD_LETTER) {
    return new Queue(name, {
      connection: createRedisConnection(redisUrl),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }

  const config = QUEUE_RETRY_CONFIG[name];

  return new Queue(name, {
    connection: createRedisConnection(redisUrl),
    defaultJobOptions: {
      attempts: config.attempts,
      backoff: { type: "custom" },
      priority: config.priority,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
}

/** Lazily resolve a named queue using the shared Redis connection config. */
export function getQueue(name: QueueName, redisUrl: string): Queue {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  const queue = createQueue(name, redisUrl);
  queues.set(name, queue);
  return queue;
}

/** Custom backoff delay for a queue after `attemptsMade` failures (1-based). */
export function resolveBackoffDelay(queueName: string, attemptsMade: number): number {
  const config = QUEUE_RETRY_CONFIG[queueName as keyof typeof QUEUE_RETRY_CONFIG];
  if (!config) {
    return 5000;
  }

  const index = attemptsMade - 1;
  const fallback = config.backoffDelaysMs[config.backoffDelaysMs.length - 1] ?? 5000;
  return config.backoffDelaysMs[index] ?? fallback;
}

/** Default job options for enqueue helpers — mirrors queue defaultJobOptions. */
export function defaultJobOptionsFor(name: Exclude<QueueName, typeof QUEUE_NAMES.DEAD_LETTER>) {
  const config = QUEUE_RETRY_CONFIG[name];
  return {
    attempts: config.attempts,
    backoff: { type: "custom" as const },
    priority: config.priority,
  };
}

/** Close all cached queue instances — test teardown helper. */
export async function closeAllQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}

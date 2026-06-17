import type { WorkerEnv } from "@pipewatch/config/env";
import { Worker } from "bullmq";

import { attachPermanentFailureHandler } from "./queues/dead-letter.js";
import { createRedisConnection, resolveRedisUrl } from "./queues/connection.js";
import { QUEUE_NAMES, resolveBackoffDelay } from "./queues/index.js";

const PROCESSOR_QUEUES = [
  QUEUE_NAMES.WEBHOOK_EVENTS,
  QUEUE_NAMES.BACKFILL,
  QUEUE_NAMES.POLLING,
  QUEUE_NAMES.MAINTENANCE,
] as const;

export type WorkerRuntime = {
  workers: Worker[];
  close: () => Promise<void>;
};

/** Bootstrap BullMQ workers for all processor queues — handlers land in follow-up tasks. */
export function startWorkers(env: WorkerEnv): WorkerRuntime {
  const redisUrl = resolveRedisUrl(env.REDIS_URL);
  const connection = createRedisConnection(redisUrl);

  const workers = PROCESSOR_QUEUES.map((queueName) => {
    const worker = new Worker(
      queueName,
      async (job) => ({
        processed: true,
        jobName: job.name,
        queueName,
      }),
      {
        connection,
        settings: {
          backoffStrategy: (attemptsMade, _type, _err, job) =>
            resolveBackoffDelay(job?.queueName ?? queueName, attemptsMade),
        },
      },
    );

    attachPermanentFailureHandler(worker, redisUrl);
    return worker;
  });

  return {
    workers,
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
    },
  };
}

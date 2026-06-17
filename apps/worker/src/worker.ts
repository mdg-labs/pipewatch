import type { WorkerEnv } from "@pipewatch/config/env";
import { getDb } from "@pipewatch/db";
import { Worker, type Processor } from "bullmq";

import {
  PROCESS_PIPELINE_JOB_JOB_NAME,
  processPipelineJob,
} from "./handlers/process-pipeline-job.js";
import {
  PROCESS_PIPELINE_RUN_JOB_NAME,
  processPipelineRun,
} from "./handlers/process-pipeline-run.js";
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

function createWebhookEventsProcessor(): Processor {
  const db = getDb();

  return async (job) => {
    switch (job.name) {
      case PROCESS_PIPELINE_RUN_JOB_NAME:
        return processPipelineRun(job.data, { db });
      case PROCESS_PIPELINE_JOB_JOB_NAME:
        return processPipelineJob(job.data, { db });
      default:
        throw new Error(`Unknown webhook-events job: ${job.name}`);
    }
  };
}

function createStubProcessor(queueName: string): Processor {
  return async (job) => ({
    processed: true,
    jobName: job.name,
    queueName,
  });
}

/** Bootstrap BullMQ workers for all processor queues. */
export function startWorkers(env: WorkerEnv): WorkerRuntime {
  const redisUrl = resolveRedisUrl(env.REDIS_URL);
  const connection = createRedisConnection(redisUrl);

  const workers = PROCESSOR_QUEUES.map((queueName) => {
    const processor =
      queueName === QUEUE_NAMES.WEBHOOK_EVENTS
        ? createWebhookEventsProcessor()
        : createStubProcessor(queueName);

    const worker = new Worker(queueName, processor, {
      connection,
      settings: {
        backoffStrategy: (attemptsMade, _type, _err, job) =>
          resolveBackoffDelay(job?.queueName ?? queueName, attemptsMade),
      },
    });

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

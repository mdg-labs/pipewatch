import * as Sentry from "@sentry/node";
import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { Worker, type Processor } from "bullmq";

import { runWebhookPollJob } from "./jobs/webhook-poll.js";
import { createRedisConnection } from "./queues/connection.js";
import {
  ADMIN_QUEUE_NAMES,
  resolveAdminBackoffDelay,
} from "./queues/index.js";
import { WEBHOOK_POLL_JOB_NAME } from "./queues/webhook-poll.js";

export type AdminWorkerDeps = {
  env: AdminEnv;
  db: Db;
  redisUrl: string;
  fetchImpl?: typeof fetch;
};

export type AdminWorkerRuntime = {
  worker: Worker;
  close: () => Promise<void>;
};

function createWebhookPollProcessor(deps: AdminWorkerDeps): Processor {
  return async () => {
    const pollDeps = {
      env: deps.env,
      db: deps.db,
      ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
    };
    await runWebhookPollJob(pollDeps);
  };
}

function attachJobFailureHandler(worker: Worker): void {
  worker.on("failed", (job, error) => {
    if (!job) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const err = error instanceof Error ? error : new Error(String(error));

    Sentry.captureException(err, {
      tags: {
        queue: job.queueName,
        job_name: job.name,
      },
      extra: {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      },
    });
  });
}

/** Bootstrap BullMQ worker for admin webhook polling. */
export function startAdminWorkers(deps: AdminWorkerDeps): AdminWorkerRuntime {
  const connection = createRedisConnection(deps.redisUrl);
  const processor = createWebhookPollProcessor(deps);

  const worker = new Worker(ADMIN_QUEUE_NAMES.WEBHOOK_POLL, processor, {
    connection,
    settings: {
      backoffStrategy: (attemptsMade) => resolveAdminBackoffDelay(attemptsMade),
    },
  });

  attachJobFailureHandler(worker);

  return {
    worker,
    close: async () => {
      await worker.close();
    },
  };
}

export { WEBHOOK_POLL_JOB_NAME };

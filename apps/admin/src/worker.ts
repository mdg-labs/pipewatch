import * as Sentry from "@sentry/node";
import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { Worker, type Processor } from "bullmq";

import { runRetentionCleanupJob } from "./jobs/retention-cleanup.js";
import { runWebhookPollJob } from "./jobs/webhook-poll.js";
import { createRedisConnection } from "./queues/connection.js";
import {
  ADMIN_QUEUE_NAMES,
  resolveAdminBackoffDelay,
} from "./queues/index.js";
import { RETENTION_CLEANUP_JOB_NAME } from "./queues/maintenance.js";
import { WEBHOOK_POLL_JOB_NAME } from "./queues/webhook-poll.js";
import { evaluateWebhookHealthAlerts } from "./services/alerts/webhook-health.js";

export type AdminWorkerDeps = {
  env: AdminEnv;
  db: Db;
  redisUrl: string;
  fetchImpl?: typeof fetch;
};

export type AdminWorkerRuntime = {
  workers: Worker[];
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
    await evaluateWebhookHealthAlerts({ env: deps.env, db: deps.db });
  };
}

function createRetentionCleanupProcessor(deps: AdminWorkerDeps): Processor {
  return async () => {
    await runRetentionCleanupJob({ db: deps.db });
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

function createWorker(
  queueName: string,
  processor: Processor,
  redisUrl: string,
): Worker {
  const connection = createRedisConnection(redisUrl);
  const worker = new Worker(queueName, processor, {
    connection,
    settings: {
      backoffStrategy: (attemptsMade) => resolveAdminBackoffDelay(attemptsMade),
    },
  });

  attachJobFailureHandler(worker);
  return worker;
}

/** Bootstrap BullMQ workers for admin webhook polling and maintenance. */
export function startAdminWorkers(deps: AdminWorkerDeps): AdminWorkerRuntime {
  const webhookPollWorker = createWorker(
    ADMIN_QUEUE_NAMES.WEBHOOK_POLL,
    createWebhookPollProcessor(deps),
    deps.redisUrl,
  );
  const maintenanceWorker = createWorker(
    ADMIN_QUEUE_NAMES.MAINTENANCE,
    createRetentionCleanupProcessor(deps),
    deps.redisUrl,
  );

  const workers = [webhookPollWorker, maintenanceWorker];

  return {
    workers,
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
    },
  };
}

export { RETENTION_CLEANUP_JOB_NAME, WEBHOOK_POLL_JOB_NAME };

import * as Sentry from "@sentry/node";
import type { Job, Worker } from "bullmq";

import { getQueue, QUEUE_NAMES } from "./index.js";

export type DeadLetterPayload = {
  originalQueue: string;
  originalJobName: string;
  originalJobId: string;
  data: unknown;
  error: string;
  failedAt: string;
};

/** Move a permanently failed job to the dead-letter queue. */
export async function moveToDeadLetterQueue(
  redisUrl: string,
  job: Job,
  error: Error,
): Promise<void> {
  const deadLetterQueue = getQueue(QUEUE_NAMES.DEAD_LETTER, redisUrl);
  const payload: DeadLetterPayload = {
    originalQueue: job.queueName,
    originalJobName: job.name,
    originalJobId: job.id ?? "unknown",
    data: job.data,
    error: error.message,
    failedAt: new Date().toISOString(),
  };

  await deadLetterQueue.add("dead-letter", payload);
}

/** Alert Sentry and enqueue to DLQ when a job exhausts all retry attempts. */
export function attachPermanentFailureHandler(worker: Worker, redisUrl: string): void {
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
        data: job.data,
      },
    });

    void moveToDeadLetterQueue(redisUrl, job, err).catch((dlqError: unknown) => {
      const wrapped =
        dlqError instanceof Error ? dlqError : new Error(String(dlqError));
      Sentry.captureException(wrapped);
    });
  });
}

import { Worker } from "bullmq";

import { registerCloudWorkers } from "./edition-features.js";
import { initSentry } from "./sentry.js";

initSentry();

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const stubWorker = new Worker(
  "stub",
  async () => ({ ok: true }),
  {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: null,
    },
  },
);

registerCloudWorkers();

await stubWorker.waitUntilReady();
process.stdout.write("worker ready\n");

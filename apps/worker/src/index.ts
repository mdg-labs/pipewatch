import { parseWorkerEnv } from "@pipewatch/config/env";

import { registerCloudWorkers } from "./edition-features.js";
import { resolveRedisUrl } from "./queues/connection.js";
import { registerRetentionCleanupSchedule } from "./queues/maintenance.js";
import { initSentry } from "./sentry.js";
import { startWorkers } from "./worker.js";

const env = parseWorkerEnv();

initSentry();

const runtime = startWorkers(env);

registerCloudWorkers();

const redisUrl = resolveRedisUrl(env.REDIS_URL);
await registerRetentionCleanupSchedule(redisUrl);

await Promise.all(runtime.workers.map((worker) => worker.waitUntilReady()));
process.stdout.write("worker ready\n");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void runtime.close().then(() => {
      process.exit(0);
    });
  });
}

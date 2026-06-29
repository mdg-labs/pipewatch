import { serve } from "@hono/node-server";
import { parseWorkerEnv } from "@pipewatch/config/env";

import { registerCloudWorkers } from "./edition-features.js";
import { createProbeApp } from "./probe-server.js";
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

serve({
  fetch: createProbeApp().fetch,
  port: env.PORT,
});

process.stdout.write(`worker ready (probe port ${env.PORT})\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void runtime.close().then(() => {
      process.exit(0);
    });
  });
}

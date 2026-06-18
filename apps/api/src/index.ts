import { serve } from "@hono/node-server";
import { parseApiEnv } from "@pipewatch/config/env";

import { createApp } from "./app.js";
import { initSentry } from "./sentry.js";

const env = parseApiEnv();

initSentry();

const app = createApp();
const port = env.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`api listening on http://localhost:${String(info.port)}\n`);
});

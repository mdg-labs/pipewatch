import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { initSentry } from "./sentry.js";

initSentry();

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`api listening on http://localhost:${String(info.port)}\n`);
});

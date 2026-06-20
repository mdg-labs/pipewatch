import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { parseAdminEnv } from "@pipewatch/config/env";

import { createApp } from "./app.js";

const env = parseAdminEnv();

const staticRoot =
  env.NODE_ENV === "production"
    ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web/dist")
    : null;

const app = createApp(staticRoot);
const port = env.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`admin listening on http://localhost:${String(info.port)}\n`);
});

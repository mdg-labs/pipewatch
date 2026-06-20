import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { parseAdminEnv } from "@pipewatch/config/env";
import { closeDb, createDb } from "@pipewatch/db";

import { createApp } from "./app.js";
import { bootstrapAdminUser } from "./services/auth/bootstrap.js";

const env = parseAdminEnv();

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to start the admin service");
}

const db = createDb(env.DATABASE_URL);

await bootstrapAdminUser(db, env);

const staticRoot =
  env.NODE_ENV === "production"
    ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web/dist")
    : null;

const app = createApp({ env, db }, staticRoot);
const port = env.PORT;

const shutdown = async () => {
  await closeDb();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`admin listening on http://localhost:${String(info.port)}\n`);
});

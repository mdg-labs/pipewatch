import { flags } from "@pipewatch/config/edition";
import { Hono } from "hono";

import { registerCloudRoutes } from "./edition-features.js";

export function createApp(): Hono {
  const app = new Hono();

  app.get("/", (c) => c.text("PipeWatch API"));
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      edition: flags.IS_CE ? "ce" : "cloud",
    }),
  );

  registerCloudRoutes(app);

  return app;
}

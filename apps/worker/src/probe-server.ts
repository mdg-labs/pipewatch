import { flags } from "@pipewatch/config/edition";
import { Hono } from "hono";

import packageJson from "../package.json" with { type: "json" };

/** Create the worker liveness and version probe app. */
export function createProbeApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json(
      {
        status: "ok" as const,
        edition: flags.IS_CE ? ("ce" as const) : ("cloud" as const),
      },
      200,
    ),
  );

  app.get("/version", (c) =>
    c.json(
      {
        version: packageJson.version,
      },
      200,
    ),
  );

  return app;
}

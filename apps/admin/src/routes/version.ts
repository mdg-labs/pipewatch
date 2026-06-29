import type { Hono } from "hono";

import packageJson from "../../package.json" with { type: "json" };

/** Register the public semver probe — no authentication required. */
export function registerVersionRoute(app: Hono): void {
  app.get("/version", (c) =>
    c.json(
      {
        version: packageJson.version,
      },
      200,
    ),
  );
}

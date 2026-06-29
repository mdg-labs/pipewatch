import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import type { AdminAppDeps } from "./types.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerVersionRoute } from "./routes/version.js";

/** Create the admin Hono app — API routes plus optional static SPA assets. */
export function createApp(deps: AdminAppDeps, staticRoot: string | null): Hono {
  const app = new Hono();

  registerHealthRoute(app);
  registerVersionRoute(app);
  registerApiRoutes(app, deps);

  if (staticRoot) {
    app.use("/*", serveStatic({ root: staticRoot }));
    app.get("*", serveStatic({ path: "index.html", root: staticRoot }));
  }

  return app;
}

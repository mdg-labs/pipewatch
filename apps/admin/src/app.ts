import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { registerApiRoutes } from "./routes/api.js";
import { registerHealthRoute } from "./routes/health.js";

/** Create the admin Hono app — API routes plus optional static SPA assets. */
export function createApp(staticRoot: string | null): Hono {
  const app = new Hono();

  registerHealthRoute(app);
  registerApiRoutes(app);

  if (staticRoot) {
    app.use("/*", serveStatic({ root: staticRoot }));
    app.get("*", serveStatic({ path: "index.html", root: staticRoot }));
  }

  return app;
}

import { flags } from "@pipewatch/config/edition";
import type { OpenAPIHono } from "@hono/zod-openapi";

import type { ApiEnv } from "./types.js";

/** Cloud-only routes — not registered in CE builds. */
export function registerCloudRoutes(app: OpenAPIHono<ApiEnv>): void {
  if (!flags.BILLING_ENABLED) {
    return;
  }

  app.get("/billing/stub", (c) => c.json({ status: "cloud-only" }));
}

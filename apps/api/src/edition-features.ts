import { flags } from "@pipewatch/config/edition";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { requireCE, requireCloud } from "./middleware/edition-guards.js";
import { registerPostmarkWebhookRoute } from "./routes/webhooks/postmark.js";
import { registerWaitlistRoutes } from "./routes/waitlist.js";
import type { ApiEnv } from "./types.js";

/** Cloud-only routes — not registered when edition flags are false. */
export function registerCloudRoutes(app: OpenAPIHono<ApiEnv>): void {
  if (flags.BILLING_ENABLED) {
    app.get("/billing/stub", requireCloud, (c) => c.json({ status: "cloud-only" }));
  }

  if (flags.WAITLIST_ENABLED) {
    registerWaitlistRoutes(app);
  }

  if (flags.IS_CLOUD) {
    registerPostmarkWebhookRoute(app);
  }
}

/** CE-only routes — not registered when edition flags are false. */
export function registerCERoutes(app: OpenAPIHono<ApiEnv>): void {
  if (flags.BOOTSTRAP_ENABLED) {
    app.get("/setup/stub", requireCE, (c) => c.json({ status: "ce-only" }));
  }
}

import { flags } from "@pipewatch/config/edition";
import type { Hono } from "hono";

/** Cloud-only routes — not registered in CE builds. */
export function registerCloudRoutes(app: Hono): void {
  if (!flags.BILLING_ENABLED) {
    return;
  }

  app.get("/billing/stub", (c) => c.json({ status: "cloud-only" }));
}

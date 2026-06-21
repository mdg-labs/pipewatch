import { Hono } from "hono";
import { z } from "zod";

import { requireRole } from "../middleware/require-role.js";
import {
  getPlatformMetricsSummary,
  listPlatformMetricsWorkspaces,
} from "../services/platform-metrics.js";
import type { AdminAppBindings } from "../types.js";

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

/** Read-only platform metrics routes (Admin PRD §8.5). */
export function registerPlatformMetricsRoutes(api: Hono<AdminAppBindings>): void {
  const platformMetrics = new Hono<AdminAppBindings>();

  platformMetrics.use("*", requireRole("viewer"));

  platformMetrics.get("/summary", async (c) => {
    const summary = await getPlatformMetricsSummary(c.get("db"));
    return c.json(summary, 200);
  });

  platformMetrics.get("/workspaces", async (c) => {
    const query = PaginationQuerySchema.parse(c.req.query());
    const result = await listPlatformMetricsWorkspaces(c.get("db"), {
      page: query.page,
      pageSize: query.page_size,
    });

    return c.json(result, 200);
  });

  api.route("/platform-metrics", platformMetrics);
}

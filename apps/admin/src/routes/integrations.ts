import { Hono } from "hono";
import { z } from "zod";

import { AdminHttpError } from "../lib/api-error.js";
import { requireRole } from "../middleware/require-role.js";
import { getIntegrationById, listIntegrations } from "../services/overview.js";
import type { AdminAppBindings } from "../types.js";

const IntegrationParamsSchema = z.object({
  id: z.string().uuid(),
});

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

/** Read-only integration overview routes (Admin PRD §8.5, §12.5). */
export function registerIntegrationRoutes(api: Hono<AdminAppBindings>): void {
  const integrations = new Hono<AdminAppBindings>();

  integrations.use("*", requireRole("viewer"));

  integrations.get("/", async (c) => {
    const query = PaginationQuerySchema.parse(c.req.query());
    const result = await listIntegrations(c.get("db"), {
      page: query.page,
      pageSize: query.page_size,
    });

    return c.json(result, 200);
  });

  integrations.get("/:id", async (c) => {
    const params = IntegrationParamsSchema.parse(c.req.param());
    const integration = await getIntegrationById(c.get("db"), params.id, {
      windowMinutes: c.get("env").ADMIN_ALERT_WINDOW_MINUTES,
    });

    if (!integration) {
      throw new AdminHttpError("Integration not found", 404, "NOT_FOUND");
    }

    return c.json(integration, 200);
  });

  api.route("/integrations", integrations);
}

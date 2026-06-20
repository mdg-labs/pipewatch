import { Hono } from "hono";
import { z } from "zod";

import { AdminHttpError } from "../lib/api-error.js";
import { requireRole } from "../middleware/require-role.js";
import { getWorkspaceById, listWorkspaces } from "../services/overview.js";
import type { AdminAppBindings } from "../types.js";

const WorkspaceParamsSchema = z.object({
  id: z.string().uuid(),
});

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

/** Read-only workspace overview routes (Admin PRD §8.5, §12.5). */
export function registerWorkspaceRoutes(api: Hono<AdminAppBindings>): void {
  const workspaces = new Hono<AdminAppBindings>();

  workspaces.use("*", requireRole("viewer"));

  workspaces.get("/", async (c) => {
    const query = PaginationQuerySchema.parse(c.req.query());
    const result = await listWorkspaces(c.get("db"), {
      page: query.page,
      pageSize: query.page_size,
    });

    return c.json(result, 200);
  });

  workspaces.get("/:id", async (c) => {
    const params = WorkspaceParamsSchema.parse(c.req.param());
    const workspace = await getWorkspaceById(c.get("db"), params.id);

    if (!workspace) {
      throw new AdminHttpError("Workspace not found", 404, "NOT_FOUND");
    }

    return c.json(workspace, 200);
  });

  api.route("/workspaces", workspaces);
}

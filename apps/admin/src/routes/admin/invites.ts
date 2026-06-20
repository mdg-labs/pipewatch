import { Hono } from "hono";
import { z } from "zod";

import { requireRole } from "../../middleware/require-role.js";
import {
  createAdminInvite,
  listAdminInvites,
  revokeAdminInvite,
} from "../../services/auth/invite.js";
import { AdminRoleSchema } from "../../services/auth/roles.js";
import type { AdminAppBindings } from "../../types.js";

const CreateInviteBodySchema = z.object({
  email: z.string().trim().email(),
  role: AdminRoleSchema,
});

const InviteParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Admin invite management — `platform_admin` only (Admin PRD §8.3). */
export function registerAdminInviteRoutes(api: Hono<AdminAppBindings>): void {
  const invites = new Hono<AdminAppBindings>();

  invites.use("*", requireRole("platform_admin"));

  invites.get("/", async (c) => {
    const rows = await listAdminInvites(c.get("db"));
    return c.json(rows, 200);
  });

  invites.post("/", async (c) => {
    const body = CreateInviteBodySchema.parse(await c.req.json());
    const invite = await createAdminInvite(
      c.get("db"),
      c.get("env"),
      c.get("adminUser").id,
      body,
      c.get("emailTransport"),
    );

    return c.json(invite, 201);
  });

  invites.delete("/:id", async (c) => {
    const params = InviteParamsSchema.parse(c.req.param());
    await revokeAdminInvite(c.get("db"), params.id);
    return c.body(null, 204);
  });

  api.route("/admin/invites", invites);
}

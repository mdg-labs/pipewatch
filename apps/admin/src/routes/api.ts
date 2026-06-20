import { Hono } from "hono";

import { errorHandler } from "../middleware/error-handler.js";
import { sessionMiddleware } from "../middleware/session.js";
import type { AdminAppBindings, AdminAppDeps } from "../types.js";
import { registerAdminInviteRoutes } from "./admin/invites.js";
import { registerAcceptInviteRoute } from "./auth/accept-invite.js";
import { registerLoginRoute, registerLogoutRoute } from "./auth/login.js";
import { registerIntegrationRoutes } from "./integrations.js";
import { registerWorkspaceRoutes } from "./workspaces.js";

/** Register JSON API routes under `/api/*`. */
export function registerApiRoutes(app: Hono, deps: AdminAppDeps): void {
  const api = new Hono<AdminAppBindings>();

  api.onError(errorHandler);

  api.use("*", async (c, next) => {
    c.set("env", deps.env);
    c.set("db", deps.db);
    if (deps.emailTransport) {
      c.set("emailTransport", deps.emailTransport);
    }
    await next();
  });

  registerLoginRoute(api);
  registerAcceptInviteRoute(api);

  api.use("*", sessionMiddleware());

  registerLogoutRoute(api);
  registerAdminInviteRoutes(api);
  registerWorkspaceRoutes(api);
  registerIntegrationRoutes(api);

  api.get("/v1/status", (c) =>
    c.json(
      {
        status: "ok" as const,
        service: "admin" as const,
        user: {
          id: c.get("adminUser").id,
          email: c.get("adminUser").email,
          role: c.get("adminUser").role,
        },
      },
      200,
    ),
  );

  app.route("/api", api);
}

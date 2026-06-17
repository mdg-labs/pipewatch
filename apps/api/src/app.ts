import { OpenAPIHono } from "@hono/zod-openapi";

import { registerCERoutes, registerCloudRoutes } from "./edition-features.js";
import { apiError, errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { sentryTraceMiddleware } from "./middleware/sentry.js";
import { registerGitHubAuthRoutes } from "./routes/auth/github.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerOpenApiRoutes } from "./routes/openapi.js";
import { registerBootstrapStatusRoute } from "./routes/public/bootstrap-status.js";
import type { ApiEnv } from "./types.js";

export function createApp(): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(apiError("VALIDATION_ERROR", "Request validation failed"), 422);
      }
    },
  });

  app.use("*", requestIdMiddleware);
  app.use("*", sentryTraceMiddleware);
  app.onError(errorHandler);

  app.get("/", (c) => c.text("PipeWatch API"));

  registerHealthRoute(app);
  registerOpenApiRoutes(app);
  registerBootstrapStatusRoute(app);
  registerGitHubAuthRoutes(app);
  registerCloudRoutes(app);
  registerCERoutes(app);

  return app;
}

import { OpenAPIHono } from "@hono/zod-openapi";

import { registerCERoutes, registerCloudRoutes } from "./edition-features.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import {
  apiError,
  errorHandler,
  formatZodValidationMessage,
} from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { sentryTraceMiddleware } from "./middleware/sentry.js";
import { registerGitHubAuthRoutes } from "./routes/auth/github.js";
import { registerLogoutRoutes } from "./routes/auth/logout.js";
import { registerRefreshRoute } from "./routes/auth/refresh.js";
import { registerSwitchWorkspaceRoute } from "./routes/auth/switch-workspace.js";
import { registerInviteAcceptRoutes } from "./routes/invite/accept.js";
import { registerGitHubInstallCallbackRoute } from "./routes/onboarding/github-callback.js";
import { registerGitHubWebhookRoute } from "./routes/webhooks/github.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerVersionRoute } from "./routes/version.js";
import { registerSseTokenRoute } from "./routes/sse-token.js";
import { registerOpenApiRoutes } from "./routes/openapi.js";
import { registerAppConfigRoute } from "./routes/public/app-config.js";
import { registerBootstrapStatusRoute } from "./routes/public/bootstrap-status.js";
import { registerUserMeRoutes } from "./routes/users/me.js";
import { registerWorkspaceRoutes } from "./routes/workspaces/index.js";
import type { ApiEnv } from "./types.js";

export function createApp(): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const isProduction = process.env.NODE_ENV === "production";
        const message = formatZodValidationMessage(result.error, isProduction);
        return c.json(apiError("VALIDATION_ERROR", message), 422);
      }
    },
  });

  app.use("*", createCorsMiddleware());
  app.use("*", requestIdMiddleware);
  app.use("*", sentryTraceMiddleware);
  app.onError(errorHandler);

  app.get("/", (c) => c.text("PipeWatch API"));

  registerHealthRoute(app);
  registerVersionRoute(app);
  registerOpenApiRoutes(app);
  registerBootstrapStatusRoute(app);
  registerAppConfigRoute(app);
  registerGitHubAuthRoutes(app);
  registerRefreshRoute(app);
  registerLogoutRoutes(app);
  registerSwitchWorkspaceRoute(app);
  registerUserMeRoutes(app);
  registerSseTokenRoute(app);
  registerInviteAcceptRoutes(app);
  registerGitHubInstallCallbackRoute(app);
  registerGitHubWebhookRoute(app);
  registerWorkspaceRoutes(app);
  registerCloudRoutes(app);
  registerCERoutes(app);

  return app;
}

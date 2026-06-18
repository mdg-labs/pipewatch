import * as Sentry from "@sentry/node";
import type { MiddlewareHandler } from "hono";

import type { ApiEnv } from "../types.js";

/** Continue distributed traces and record a server span per request. */
export const sentryTraceMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const sentryTrace = c.req.header("sentry-trace");
  const baggage = c.req.header("baggage");

  return Sentry.withIsolationScope((scope) => {
    const requestId = c.get("requestId");
    scope.setTag("request_id", requestId);

    return Sentry.continueTrace({ sentryTrace, baggage }, () =>
      Sentry.startSpan(
        {
          op: "http.server",
          name: `${c.req.method} ${c.req.path}`,
          attributes: {
            "http.method": c.req.method,
            "http.route": c.req.path,
          },
        },
        async (span) => {
          await next();
          span.setAttribute("http.status_code", c.res.status);
        },
      ),
    );
  });
};

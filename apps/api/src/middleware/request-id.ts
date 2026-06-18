import { randomUUID } from "node:crypto";

import type { MiddlewareHandler } from "hono";

import type { ApiEnv } from "../types.js";

export const REQUEST_ID_HEADER = "X-Request-Id";

/** Assign or propagate a request ID on every request. */
export const requestIdMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const requestId = c.req.header(REQUEST_ID_HEADER) ?? randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header(REQUEST_ID_HEADER, requestId);
};

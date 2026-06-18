import { flags } from "@pipewatch/config/edition";
import type { MiddlewareHandler } from "hono";

import { apiError } from "./error-handler.js";
import type { ApiEnv } from "../types.js";

/** Block CE requests to cloud-only routes — returns 404 (not 403). */
export const requireCloud: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (!flags.IS_CLOUD) {
    return c.json(apiError("NOT_FOUND", "Not found"), 404);
  }

  await next();
};

/** Block Cloud requests to CE-only routes — returns 404 (not 403). */
export const requireCE: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (!flags.IS_CE) {
    return c.json(apiError("NOT_FOUND", "Not found"), 404);
  }

  await next();
};

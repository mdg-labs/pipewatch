import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

import { AdminHttpError, apiError } from "../lib/api-error.js";
import type { AdminAppBindings } from "../types.js";

/** Map domain errors to JSON responses for admin API routes. */
export const errorHandler: ErrorHandler<AdminAppBindings> = (error, c) => {
  if (error instanceof ZodError) {
    const [first] = error.issues;
    return c.json(
      apiError("BAD_REQUEST", first?.message ?? "Request validation failed"),
      400,
    );
  }

  if (error instanceof AdminHttpError) {
    return c.json(apiError(error.code, error.message), error.status as ContentfulStatusCode);
  }

  if (error instanceof HTTPException) {
    const status = error.status as ContentfulStatusCode;
    const code =
      status === 400
        ? "BAD_REQUEST"
        : status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : "INTERNAL_ERROR";

    return c.json(apiError(code, error.message), status);
  }

  throw error;
};

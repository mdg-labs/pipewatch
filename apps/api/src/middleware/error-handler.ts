import { z } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const ApiErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "NOT_FOUND" }),
      message: z.string().openapi({ example: "Resource not found" }),
    }),
  })
  .openapi("ApiError");

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export function apiError(code: string, message: string): ApiErrorEnvelope {
  return { error: { code, message } };
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR";
  }
}

/** Standard `{ error: { code, message } }` envelope for all API errors. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(apiError(statusToCode(err.status), err.message), err.status);
  }

  return c.json(apiError("INTERNAL_ERROR", "An unexpected error occurred"), 500);
};

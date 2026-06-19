import { z } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

type ValidationIssue = {
  path: PropertyKey[];
  message: string;
  code: string;
};

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

/** Map OpenAPI/Zod request validation failures to a safe API message. */
export function formatZodValidationMessage(
  error: { issues: ValidationIssue[] },
  isProduction: boolean,
): string {
  const [first] = error.issues;
  if (!first) {
    return "Request validation failed";
  }

  if (!isProduction) {
    const field = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
    return `${field}${first.message}`;
  }

  const field = first.path.length > 0 ? first.path.join(".") : "request";
  if (first.code === "invalid_type" && first.path.length === 0) {
    return "Request validation failed";
  }

  if (
    first.code === "invalid_format" ||
    first.code === "invalid_string" ||
    first.code === "too_small" ||
    first.code === "too_big"
  ) {
    return `Invalid ${field}`;
  }

  return "Request validation failed";
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
    case 429:
      return "RATE_LIMITED";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR";
  }
}

const LOG_REDACT_PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,
  /ghs_[a-zA-Z0-9]+/g,
  /pw_[a-zA-Z0-9]+/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
];

function redactLogMessage(message: string): string {
  let redacted = message;
  for (const pattern of LOG_REDACT_PATTERNS) {
    redacted = redacted.replace(pattern, "[Redacted]");
  }
  return redacted;
}

/** Log unhandled request errors to stdout — name/message only, secrets redacted. */
export function logUnhandledRequestError(requestId: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactLogMessage(rawMessage);

  process.stderr.write(
    `${JSON.stringify({ level: "error", requestId, error: { name, message } })}\n`,
  );
}

/** Standard `{ error: { code, message } }` envelope for all API errors. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(apiError(statusToCode(err.status), err.message), err.status);
  }

  return c.json(apiError("INTERNAL_ERROR", "An unexpected error occurred"), 500);
};

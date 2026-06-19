import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";

import { type ApiEnv } from "@pipewatch/config/env";

import type { ApiEnv as HonoApiEnv } from "../types.js";

function readCorsEnv(): Pick<ApiEnv, "APP_URL" | "MARKETING_URL"> {
  return {
    APP_URL: process.env.APP_URL,
    MARKETING_URL: process.env.MARKETING_URL,
  };
}

/** Normalize a configured URL to an origin suitable for CORS comparison. */
export function normalizeOrigin(url: string): string {
  return new URL(url).origin;
}

/** Build the per-environment CORS allowlist from `APP_URL` and `MARKETING_URL`. */
export function buildCorsAllowlist(env: Pick<ApiEnv, "APP_URL" | "MARKETING_URL">): string[] {
  const origins: string[] = [];

  for (const configuredUrl of [env.APP_URL, env.MARKETING_URL]) {
    if (configuredUrl) {
      origins.push(normalizeOrigin(configuredUrl));
    }
  }

  return [...new Set(origins)];
}

/** CORS middleware — allowlisted origins only; credentials enabled (no wildcard). */
export function createCorsMiddleware(
  env: Pick<ApiEnv, "APP_URL" | "MARKETING_URL"> = readCorsEnv(),
): MiddlewareHandler<HonoApiEnv> {
  const allowlist = buildCorsAllowlist(env);

  return cors({
    origin: (origin) => {
      if (!origin) {
        return null;
      }

      return allowlist.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });
}

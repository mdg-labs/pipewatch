import { z, type ZodError, type ZodTypeAny } from "zod";

import { parseEdition, type PipeWatchEdition } from "./edition.js";
import {
  API_CLOUD_STRICT_FIELDS,
  API_STRICT_FIELDS,
  MARKETING_CLOUD_STRICT_FIELDS,
  WEB_STRICT_FIELDS,
  WORKER_STRICT_FIELDS,
} from "./strict-env-fields.js";

export {
  API_CLOUD_STRICT_FIELDS,
  API_STRICT_FIELDS,
  MARKETING_CLOUD_STRICT_FIELDS,
  WEB_STRICT_FIELDS,
  WORKER_STRICT_FIELDS,
} from "./strict-env-fields.js";

/** Marketing CTA behaviour — waitlist form vs live cloud signup. */
export const launchModeSchema = z.enum(["waitlist", "live"]);
export type LaunchMode = z.infer<typeof launchModeSchema>;

export const nodeEnvSchema = z.enum(["development", "staging", "production"]);
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export const pipewatchModeSchema = z.enum(["webhook", "polling"]);
export type PipewatchMode = z.infer<typeof pipewatchModeSchema>;

const secretMin32 = z
  .string()
  .min(32, "must be at least 32 characters for production use");

/** Shared env vars used across multiple services. */
export const sharedEnvSchema = z.object({
  ENCRYPTION_KEY: secretMin32,
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;

const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PIPEWATCH_EDITION: z.enum(["ce", "cloud"]).optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  ENCRYPTION_KEY: secretMin32.optional(),
  SENTRY_DSN: z.string().optional(),
  JWT_SECRET: secretMin32.optional(),
  JWT_REFRESH_SECRET: secretMin32.optional(),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  APP_URL: z.string().url().optional(),
  MARKETING_URL: z.string().url().optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  POSTMARK_API_KEY: z.string().optional(),
  POSTMARK_BROADCAST_STREAM: z.string().optional(),
  POSTMARK_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_PRO: z.string().min(1).optional(),
  STRIPE_PRICE_BUSINESS: z.string().min(1).optional(),
  PIPEWATCH_MODE: pipewatchModeSchema
    .default("webhook")
    .describe(
      "Self-hosted ingestion mode: webhook (default) or polling (CE global override when no public webhook endpoint)",
    ),
  PORT: z.coerce.number().int().positive().default(3001),
});

const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PIPEWATCH_EDITION: z.enum(["ce", "cloud"]).optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  ENCRYPTION_KEY: secretMin32.optional(),
  SENTRY_DSN: z.string().optional(),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  PIPEWATCH_MODE: pipewatchModeSchema
    .default("webhook")
    .describe(
      "Self-hosted ingestion mode: webhook (default) or polling (CE global override when no public webhook endpoint)",
    ),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PIPEWATCH_EDITION: z.enum(["ce", "cloud"]).optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
});

const marketingEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PIPEWATCH_EDITION: z.enum(["ce", "cloud"]).optional(),
  LAUNCH_MODE: launchModeSchema.default("waitlist"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
  UMAMI_SCRIPT_URL: z.string().url().optional(),
  UMAMI_WEBSITE_ID: z.string().min(1).optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type MarketingEnv = z.infer<typeof marketingEnvSchema>;

function isStrictNodeEnv(nodeEnv: NodeEnv): boolean {
  return nodeEnv === "production" || nodeEnv === "staging";
}

function validateRequiredFields(
  data: Record<string, unknown>,
  fields: readonly string[],
  issues: z.ZodIssue[],
  label = "required in production and staging",
): void {
  for (const field of fields) {
    const value = data[field];
    if (typeof value !== "string" || value.length === 0) {
      issues.push({
        code: "custom",
        path: [field],
        message: `${field} is ${label}`,
      });
    }
  }
}

/** Format Zod validation failures into actionable startup errors. */
export function formatEnvError(error: ZodError, app: string): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });

  return [
    `Invalid ${app} environment variables:`,
    ...lines,
    "",
    `Copy apps/${app}/.env.example and set values for your edition.`,
  ].join("\n");
}

function parseAppEnv<T>(
  schema: ZodTypeAny,
  input: Record<string, unknown>,
  app: string,
  edition: PipeWatchEdition,
  validateStrict: (data: Record<string, unknown>, issues: z.ZodIssue[]) => void,
): T {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error, app));
  }

  const data = parsed.data as Record<string, unknown>;
  const nodeEnv = data.NODE_ENV as NodeEnv;

  if (isStrictNodeEnv(nodeEnv)) {
    const issues: z.ZodIssue[] = [];
    validateStrict(data, issues);

    if (edition === "cloud" && app === "api") {
      validateRequiredFields(data, API_CLOUD_STRICT_FIELDS, issues);
    }

    if (edition === "cloud" && app === "marketing") {
      validateRequiredFields(data, MARKETING_CLOUD_STRICT_FIELDS, issues);
    }

    if (issues.length > 0) {
      throw new Error(formatEnvError({ issues } as ZodError, app));
    }
  }

  return parsed.data as T;
}

function pickRaw(
  raw: Record<string, string | undefined>,
  keys: readonly string[],
): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};
  for (const key of keys) {
    picked[key] = raw[key];
  }
  return picked;
}

/** Parse and validate shared environment variables — fails fast on invalid values. */
export function parseSharedEnv(
  raw: Record<string, string | undefined> = process.env,
): SharedEnv {
  const result = sharedEnvSchema.safeParse({
    ENCRYPTION_KEY: raw.ENCRYPTION_KEY,
    REDIS_URL: raw.REDIS_URL,
    SENTRY_DSN: raw.SENTRY_DSN,
  });

  if (!result.success) {
    throw new Error(formatEnvError(result.error, "shared"));
  }

  return result.data;
}

/** Parse and validate API environment variables for the active edition. */
export function parseApiEnv(
  raw: Record<string, string | undefined> = process.env,
  edition: PipeWatchEdition = parseEdition(raw.PIPEWATCH_EDITION),
): ApiEnv {
  return parseAppEnv<ApiEnv>(
    apiEnvSchema,
    pickRaw(raw, [
      "NODE_ENV",
      "PIPEWATCH_EDITION",
      "DATABASE_URL",
      "REDIS_URL",
      "ENCRYPTION_KEY",
      "SENTRY_DSN",
      "JWT_SECRET",
      "JWT_REFRESH_SECRET",
      "GITHUB_APP_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "GITHUB_WEBHOOK_SECRET",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
      "GITHUB_APP_SLUG",
      "APP_URL",
      "MARKETING_URL",
      "PUBLIC_API_URL",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
      "POSTMARK_API_KEY",
      "POSTMARK_BROADCAST_STREAM",
      "POSTMARK_WEBHOOK_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_PRO",
      "STRIPE_PRICE_BUSINESS",
      "PIPEWATCH_MODE",
      "PORT",
    ]),
    "api",
    edition,
    (data, issues) => {
      validateRequiredFields(data, API_STRICT_FIELDS, issues);
    },
  );
}

/** Parse and validate worker environment variables for the active edition. */
export function parseWorkerEnv(
  raw: Record<string, string | undefined> = process.env,
  edition: PipeWatchEdition = parseEdition(raw.PIPEWATCH_EDITION),
): WorkerEnv {
  return parseAppEnv<WorkerEnv>(
    workerEnvSchema,
    pickRaw(raw, [
      "NODE_ENV",
      "PIPEWATCH_EDITION",
      "DATABASE_URL",
      "REDIS_URL",
      "ENCRYPTION_KEY",
      "SENTRY_DSN",
      "GITHUB_APP_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "PIPEWATCH_MODE",
      "RETENTION_DAYS",
    ]),
    "worker",
    edition,
    (data, issues) => {
      validateRequiredFields(data, WORKER_STRICT_FIELDS, issues);
    },
  );
}

/** Parse and validate web dashboard environment variables for the active edition. */
export function parseWebEnv(
  raw: Record<string, string | undefined> = process.env,
  edition: PipeWatchEdition = parseEdition(raw.PIPEWATCH_EDITION),
): WebEnv {
  return parseAppEnv<WebEnv>(
    webEnvSchema,
    pickRaw(raw, [
      "NODE_ENV",
      "PIPEWATCH_EDITION",
      "NEXT_PUBLIC_API_URL",
      "SENTRY_DSN",
    ]),
    "web",
    edition,
    (data, issues) => {
      validateRequiredFields(data, WEB_STRICT_FIELDS, issues);
    },
  );
}

/** Parse and validate marketing site environment variables for the active edition. */
export function parseMarketingEnv(
  raw: Record<string, string | undefined> = process.env,
  edition: PipeWatchEdition = parseEdition(raw.PIPEWATCH_EDITION),
): MarketingEnv {
  return parseAppEnv<MarketingEnv>(
    marketingEnvSchema,
    pickRaw(raw, [
      "NODE_ENV",
      "PIPEWATCH_EDITION",
      "LAUNCH_MODE",
      "NEXT_PUBLIC_APP_URL",
      "SENTRY_DSN",
      "UMAMI_SCRIPT_URL",
      "UMAMI_WEBSITE_ID",
    ]),
    "marketing",
    edition,
    () => {
      // LAUNCH_MODE has a schema default; cloud Umami vars checked in parseAppEnv.
    },
  );
}

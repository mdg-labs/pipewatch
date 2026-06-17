import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  launchModeSchema,
  parseApiEnv,
  parseMarketingEnv,
  parseSharedEnv,
  parseWebEnv,
  parseWorkerEnv,
} from "./env.js";

const secret = "a".repeat(32);
const pemKey = "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----";

const baseApiEnv = {
  NODE_ENV: "production",
  PIPEWATCH_EDITION: "ce",
  DATABASE_URL: "postgresql://pipewatch:pipewatch@localhost:5432/pipewatch",
  REDIS_URL: "redis://localhost:6379",
  ENCRYPTION_KEY: secret,
  JWT_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: pemKey,
  GITHUB_WEBHOOK_SECRET: "webhook-secret",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "pipewatch",
  APP_URL: "https://cloud.pipewatch.app",
  MARKETING_URL: "https://pipewatch.app",
} as const;

const baseWorkerEnv = {
  NODE_ENV: "production",
  PIPEWATCH_EDITION: "ce",
  DATABASE_URL: "postgresql://pipewatch:pipewatch@localhost:5432/pipewatch",
  REDIS_URL: "redis://localhost:6379",
  ENCRYPTION_KEY: secret,
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: pemKey,
} as const;

const baseWebEnv = {
  NODE_ENV: "production",
  PIPEWATCH_EDITION: "ce",
  NEXT_PUBLIC_API_URL: "https://cloud.pipewatch.app",
} as const;

const baseMarketingEnv = {
  NODE_ENV: "production",
  PIPEWATCH_EDITION: "ce",
  LAUNCH_MODE: "waitlist",
} as const;

const cloudStripeEnv = {
  POSTMARK_WEBHOOK_SECRET: "postmark-webhook-secret",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_PRO: "price_pro",
  STRIPE_PRICE_BUSINESS: "price_business",
} as const;

const cloudUmamiEnv = {
  UMAMI_SCRIPT_URL: "https://analytics.example.com/script.js",
  UMAMI_WEBSITE_ID: "site-id",
} as const;

describe("launchModeSchema", () => {
  it("accepts waitlist and live", () => {
    expect(launchModeSchema.parse("waitlist")).toBe("waitlist");
    expect(launchModeSchema.parse("live")).toBe("live");
  });

  it("rejects pre and other values", () => {
    expect(() => launchModeSchema.parse("pre")).toThrow(ZodError);
    expect(() => launchModeSchema.parse("signup")).toThrow(ZodError);
  });
});

describe("parseSharedEnv", () => {
  it("accepts ENCRYPTION_KEY with at least 32 characters", () => {
    expect(parseSharedEnv({ ENCRYPTION_KEY: secret })).toEqual({
      ENCRYPTION_KEY: secret,
      REDIS_URL: undefined,
      SENTRY_DSN: undefined,
    });
  });

  it("accepts optional REDIS_URL and SENTRY_DSN when valid", () => {
    expect(
      parseSharedEnv({
        ENCRYPTION_KEY: secret,
        REDIS_URL: "redis://localhost:6379",
        SENTRY_DSN: "https://example@sentry.io/1",
      }),
    ).toEqual({
      ENCRYPTION_KEY: secret,
      REDIS_URL: "redis://localhost:6379",
      SENTRY_DSN: "https://example@sentry.io/1",
    });
  });

  it("rejects invalid REDIS_URL", () => {
    expect(() =>
      parseSharedEnv({ ENCRYPTION_KEY: secret, REDIS_URL: "not-a-url" }),
    ).toThrow(/Invalid shared environment variables/);
  });

  it("rejects missing ENCRYPTION_KEY", () => {
    expect(() => parseSharedEnv({})).toThrow(/Invalid shared environment variables/);
  });

  it("rejects ENCRYPTION_KEY shorter than 32 characters", () => {
    expect(() => parseSharedEnv({ ENCRYPTION_KEY: "short-key" })).toThrow(
      /Invalid shared environment variables/,
    );
  });
});

describe("formatEnvError", () => {
  it("includes app name and env.example hint", () => {
    try {
      parseSharedEnv({});
    } catch (error) {
      expect((error as Error).message).toContain("Invalid shared environment variables:");
      expect((error as Error).message).toContain("apps/shared/.env.example");
    }
  });
});

describe("parseApiEnv", () => {
  it("accepts valid CE production env", () => {
    const env = parseApiEnv({ ...baseApiEnv }, "ce");
    expect(env.PIPEWATCH_MODE).toBe("webhook");
    expect(env.PORT).toBe(3001);
    expect(env.APP_URL).toBe(baseApiEnv.APP_URL);
  });

  it("accepts valid cloud production env with Stripe keys", () => {
    const env = parseApiEnv(
      { ...baseApiEnv, PIPEWATCH_EDITION: "cloud", ...cloudStripeEnv },
      "cloud",
    );
    expect(env.STRIPE_SECRET_KEY).toBe(cloudStripeEnv.STRIPE_SECRET_KEY);
  });

  it("allows missing secrets in development", () => {
    expect(
      parseApiEnv({ NODE_ENV: "development", PIPEWATCH_EDITION: "ce" }, "ce"),
    ).toMatchObject({
      NODE_ENV: "development",
      PIPEWATCH_MODE: "webhook",
    });
  });

  it("rejects missing required CE fields in production", () => {
    expect(() =>
      parseApiEnv({ NODE_ENV: "production", PIPEWATCH_EDITION: "ce" }, "ce"),
    ).toThrow(/JWT_SECRET is required in production and staging/);
  });

  it("rejects missing Stripe fields for cloud production", () => {
    expect(() => parseApiEnv({ ...baseApiEnv, PIPEWATCH_EDITION: "cloud" }, "cloud")).toThrow(
      /STRIPE_SECRET_KEY is required in production and staging/,
    );
  });

  it("rejects invalid APP_URL", () => {
    expect(() =>
      parseApiEnv({ ...baseApiEnv, APP_URL: "not-a-url" }, "ce"),
    ).toThrow(/Invalid api environment variables/);
  });
});

describe("parseWorkerEnv", () => {
  it("accepts valid CE production env", () => {
    const env = parseWorkerEnv({ ...baseWorkerEnv }, "ce");
    expect(env.RETENTION_DAYS).toBe(30);
    expect(env.PIPEWATCH_MODE).toBe("webhook");
  });

  it("accepts valid cloud production env", () => {
    expect(
      parseWorkerEnv({ ...baseWorkerEnv, PIPEWATCH_EDITION: "cloud" }, "cloud"),
    ).toMatchObject({
      DATABASE_URL: baseWorkerEnv.DATABASE_URL,
    });
  });

  it("allows missing secrets in development", () => {
    expect(
      parseWorkerEnv({ NODE_ENV: "development", PIPEWATCH_EDITION: "ce" }, "ce"),
    ).toMatchObject({ RETENTION_DAYS: 30 });
  });

  it("rejects missing required fields in staging", () => {
    expect(() =>
      parseWorkerEnv({ NODE_ENV: "staging", PIPEWATCH_EDITION: "ce" }, "ce"),
    ).toThrow(/DATABASE_URL is required in production and staging/);
  });
});

describe("parseWebEnv", () => {
  it("accepts valid CE production env", () => {
    expect(parseWebEnv({ ...baseWebEnv }, "ce")).toEqual({
      NODE_ENV: "production",
      PIPEWATCH_EDITION: "ce",
      NEXT_PUBLIC_API_URL: baseWebEnv.NEXT_PUBLIC_API_URL,
      SENTRY_DSN: undefined,
    });
  });

  it("accepts valid cloud production env", () => {
    expect(
      parseWebEnv({ ...baseWebEnv, PIPEWATCH_EDITION: "cloud" }, "cloud"),
    ).toMatchObject({
      NEXT_PUBLIC_API_URL: baseWebEnv.NEXT_PUBLIC_API_URL,
    });
  });

  it("allows missing API URL in development", () => {
    expect(parseWebEnv({ NODE_ENV: "development" }, "ce")).toMatchObject({
      NODE_ENV: "development",
    });
  });

  it("rejects missing NEXT_PUBLIC_API_URL in production", () => {
    expect(() => parseWebEnv({ NODE_ENV: "production" }, "ce")).toThrow(
      /NEXT_PUBLIC_API_URL is required in production and staging/,
    );
  });
});

describe("parseMarketingEnv", () => {
  it("accepts valid CE production env with waitlist mode", () => {
    expect(parseMarketingEnv({ ...baseMarketingEnv }, "ce")).toMatchObject({
      LAUNCH_MODE: "waitlist",
    });
  });

  it("accepts live launch mode", () => {
    expect(
      parseMarketingEnv({ ...baseMarketingEnv, LAUNCH_MODE: "live" }, "ce"),
    ).toMatchObject({ LAUNCH_MODE: "live" });
  });

  it("requires Umami vars for cloud production", () => {
    expect(() =>
      parseMarketingEnv({ ...baseMarketingEnv, PIPEWATCH_EDITION: "cloud" }, "cloud"),
    ).toThrow(/UMAMI_SCRIPT_URL is required in production and staging/);
  });

  it("accepts valid cloud production env with Umami", () => {
    expect(
      parseMarketingEnv(
        { ...baseMarketingEnv, PIPEWATCH_EDITION: "cloud", ...cloudUmamiEnv },
        "cloud",
      ),
    ).toMatchObject(cloudUmamiEnv);
  });

  it("rejects invalid launch mode values", () => {
    expect(() =>
      parseMarketingEnv({ ...baseMarketingEnv, LAUNCH_MODE: "pre" }, "ce"),
    ).toThrow(/Invalid marketing environment variables/);
  });

  it("defaults launch mode to waitlist in development", () => {
    expect(parseMarketingEnv({ NODE_ENV: "development" }, "ce")).toMatchObject({
      LAUNCH_MODE: "waitlist",
    });
  });
});

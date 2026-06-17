import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseSharedEnv } from "./env.js";

describe("parseSharedEnv", () => {
  it("accepts ENCRYPTION_KEY with at least 32 characters", () => {
    const key = "a".repeat(32);
    expect(parseSharedEnv({ ENCRYPTION_KEY: key })).toEqual({
      ENCRYPTION_KEY: key,
      REDIS_URL: undefined,
      SENTRY_DSN: undefined,
    });
  });

  it("accepts optional REDIS_URL and SENTRY_DSN when valid", () => {
    const key = "a".repeat(32);
    expect(
      parseSharedEnv({
        ENCRYPTION_KEY: key,
        REDIS_URL: "redis://localhost:6379",
        SENTRY_DSN: "https://example@sentry.io/1",
      }),
    ).toEqual({
      ENCRYPTION_KEY: key,
      REDIS_URL: "redis://localhost:6379",
      SENTRY_DSN: "https://example@sentry.io/1",
    });
  });

  it("rejects invalid REDIS_URL", () => {
    const key = "a".repeat(32);
    expect(() =>
      parseSharedEnv({ ENCRYPTION_KEY: key, REDIS_URL: "not-a-url" }),
    ).toThrow(ZodError);
  });

  it("rejects missing ENCRYPTION_KEY", () => {
    expect(() => parseSharedEnv({})).toThrow(ZodError);
  });

  it("rejects ENCRYPTION_KEY shorter than 32 characters", () => {
    expect(() => parseSharedEnv({ ENCRYPTION_KEY: "short-key" })).toThrow(
      ZodError,
    );
  });
});

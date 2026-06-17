import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseSharedEnv } from "./env.js";

describe("parseSharedEnv", () => {
  it("accepts ENCRYPTION_KEY with at least 32 characters", () => {
    const key = "a".repeat(32);
    expect(parseSharedEnv({ ENCRYPTION_KEY: key })).toEqual({
      ENCRYPTION_KEY: key,
    });
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

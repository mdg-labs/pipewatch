import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { buildFlags, parseEdition } from "./edition.js";

const CE_FLAGS = {
  BILLING_ENABLED: false,
  PLAN_LIMITS_ENABLED: false,
  WAITLIST_ENABLED: false,
  NEWSLETTER_ENABLED: false,
  MULTI_WORKSPACE_ENABLED: false,
  BOOTSTRAP_ENABLED: true,
  UMAMI_ENABLED: false,
  STRIPE_ENABLED: false,
  API_KEYS_ENABLED: true,
  SSO_ENABLED: false,
  RETENTION_CEILING: false,
  IS_CE: true,
  IS_CLOUD: false,
} as const;

const CLOUD_FLAGS = {
  BILLING_ENABLED: true,
  PLAN_LIMITS_ENABLED: true,
  WAITLIST_ENABLED: true,
  NEWSLETTER_ENABLED: true,
  MULTI_WORKSPACE_ENABLED: true,
  BOOTSTRAP_ENABLED: false,
  UMAMI_ENABLED: true,
  STRIPE_ENABLED: true,
  API_KEYS_ENABLED: true,
  SSO_ENABLED: false,
  RETENTION_CEILING: true,
  IS_CE: false,
  IS_CLOUD: true,
} as const;

describe("parseEdition", () => {
  it("defaults to ce when unset", () => {
    expect(parseEdition(undefined)).toBe("ce");
  });

  it("accepts ce and cloud", () => {
    expect(parseEdition("ce")).toBe("ce");
    expect(parseEdition("cloud")).toBe("cloud");
  });

  it("rejects invalid values", () => {
    expect(() => parseEdition("enterprise")).toThrow(ZodError);
    expect(() => parseEdition("")).toThrow(ZodError);
  });
});

describe("buildFlags", () => {
  it("derives CE flag matrix", () => {
    expect(buildFlags("ce")).toEqual(CE_FLAGS);
  });

  it("derives cloud flag matrix", () => {
    expect(buildFlags("cloud")).toEqual(CLOUD_FLAGS);
  });
});

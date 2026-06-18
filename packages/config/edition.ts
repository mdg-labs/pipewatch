import { z } from "zod";

const editionSchema = z.enum(["ce", "cloud"]);

export type PipeWatchEdition = z.infer<typeof editionSchema>;

/** Parse and validate `PIPEWATCH_EDITION` — fails fast on invalid values. */
export function parseEdition(raw: string | undefined): PipeWatchEdition {
  return editionSchema.parse(raw ?? "ce");
}

/** Derive runtime feature flags from a validated edition value. */
export function buildFlags(edition: PipeWatchEdition) {
  return {
    BILLING_ENABLED: edition === "cloud",
    PLAN_LIMITS_ENABLED: edition === "cloud",
    WAITLIST_ENABLED: edition === "cloud",
    NEWSLETTER_ENABLED: edition === "cloud",
    MULTI_WORKSPACE_ENABLED: edition === "cloud",
    BOOTSTRAP_ENABLED: edition === "ce",
    UMAMI_ENABLED: edition === "cloud",
    STRIPE_ENABLED: edition === "cloud",
    API_KEYS_ENABLED: true,
    SSO_ENABLED: false,
    RETENTION_CEILING: edition === "cloud",
    IS_CE: edition === "ce",
    IS_CLOUD: edition === "cloud",
  } as const;
}

export type EditionFlags = ReturnType<typeof buildFlags>;

const edition = parseEdition(process.env.PIPEWATCH_EDITION);

export const flags = buildFlags(edition);

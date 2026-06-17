import { z } from "zod";

/** Shared env vars used across multiple services. */
export const sharedEnvSchema = z.object({
  ENCRYPTION_KEY: z.string().min(32),
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;

/** Parse and validate shared environment variables — fails fast on invalid values. */
export function parseSharedEnv(
  raw: Record<string, string | undefined> = process.env,
): SharedEnv {
  return sharedEnvSchema.parse({
    ENCRYPTION_KEY: raw.ENCRYPTION_KEY,
    REDIS_URL: raw.REDIS_URL,
    SENTRY_DSN: raw.SENTRY_DSN,
  });
}

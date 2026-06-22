import { parseMarketingEnv, type MarketingEnv } from "@pipewatch/config/env";

let cached: MarketingEnv | undefined;

/** Validated marketing environment — server-side only. */
export function getMarketingEnv(): MarketingEnv {
  cached ??= parseMarketingEnv(process.env);
  return cached;
}

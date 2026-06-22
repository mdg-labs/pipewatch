import { flags } from "@pipewatch/config/edition";

import { getUmamiConfig } from "@/lib/env";

/** Self-hosted Umami — marketing site only; no-op when disabled or unconfigured. */
export function UmamiScript() {
  if (!flags.UMAMI_ENABLED) {
    return null;
  }

  const config = getUmamiConfig();
  if (!config) {
    return null;
  }

  return (
    <script
      defer
      src={config.scriptUrl}
      data-website-id={config.websiteId}
    />
  );
}

import { RPReporter } from "@reportportal/agent-js-vitest";
import type { UserConfig } from "vitest/config";

import {
  readReportPortalEnv,
  reportPortalAttributes,
  reportPortalEndpoint,
  reportPortalLaunchName,
  type ReportPortalLayer,
} from "./reportportal-ci.js";

export function withReportPortal(
  layer: ReportPortalLayer,
  packageName: string,
  config: UserConfig,
): UserConfig {
  const env = readReportPortalEnv();
  if (!env) {
    return config;
  }

  const launchId = process.env.RP_LAUNCH_ID?.trim();
  const rpReporter = new RPReporter({
    apiKey: env.apiKey,
    endpoint: reportPortalEndpoint(env.url),
    project: env.project,
    launch: reportPortalLaunchName(layer),
    ...(launchId ? { launchId } : {}),
    attributes: reportPortalAttributes(layer, packageName),
  });

  const existingReporters = config.test?.reporters;
  const reporters = Array.isArray(existingReporters)
    ? [...existingReporters, rpReporter]
    : ["default", rpReporter];

  return {
    ...config,
    test: {
      ...config.test,
      reporters,
    },
  };
}

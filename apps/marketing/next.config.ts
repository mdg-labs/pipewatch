import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const marketingRoot = path.dirname(fileURLToPath(import.meta.url));

const sentryOrg = process.env.SENTRY_ORG;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryProject = process.env.SENTRY_PROJECT ?? "pipewatch-marketing";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pipewatch/config", "@pipewatch/ui"],
  productionBrowserSourceMaps: true,
  webpack(config) {
    config.module.rules.push({
      test: /\.(md|mdx)$/,
      include: path.join(marketingRoot, "content"),
      type: "asset/source",
    });
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  ...(sentryOrg ? { org: sentryOrg } : {}),
  project: sentryProject,
  ...(sentryAuthToken ? { authToken: sentryAuthToken } : {}),
  silent: !sentryAuthToken,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});

import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const sentryOrg = process.env.SENTRY_ORG;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryProject = process.env.SENTRY_PROJECT ?? "pipewatch-web";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pipewatch/config", "@pipewatch/ui"],
  output: "standalone",
  outputFileTracingRoot: rootDir,
  productionBrowserSourceMaps: true,
  env: {
    PIPEWATCH_EDITION: process.env.PIPEWATCH_EDITION ?? "ce",
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  ...(sentryOrg ? { org: sentryOrg } : {}),
  project: sentryProject,
  ...(sentryAuthToken ? { authToken: sentryAuthToken } : {}),
  silent: !sentryAuthToken,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});

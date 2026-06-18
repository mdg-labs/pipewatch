import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const sentryOrg = process.env.SENTRY_ORG;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryProject = process.env.SENTRY_PROJECT ?? "pipewatch-marketing";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pipewatch/config", "@pipewatch/ui"],
  productionBrowserSourceMaps: true,
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

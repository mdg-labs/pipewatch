import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const marketingRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pipewatch/config", "@pipewatch/ui"],
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "https://docs.pipewatch.app",
        permanent: true,
      },
      {
        source: "/docs/:path*",
        destination: "https://docs.pipewatch.app/:path*",
        permanent: true,
      },
    ];
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.(md|mdx)$/,
      include: path.join(marketingRoot, "content"),
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;

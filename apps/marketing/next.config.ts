import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pipewatch/config", "@pipewatch/ui"],
};

export default nextConfig;

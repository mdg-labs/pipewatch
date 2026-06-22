import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  redirects: {
    "/docs": {
      status: 308,
      destination: "https://docs.pipewatch.app",
    },
    "/docs/[...path]": {
      status: 308,
      destination: "https://docs.pipewatch.app/[...path]",
    },
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "passthrough",
  }),
  integrations: [react(), mdx()],
  vite: {
    esbuild: {
      target: "esnext",
    },
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "esnext",
      },
    },
    ssr: {
      noExternal: ["@pipewatch/ui", "@pipewatch/config"],
    },
  },
});

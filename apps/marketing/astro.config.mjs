import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  // Marketing has no server-side session state — avoid SESSION KV auto-provision on deploy.
  session: {
    driver: {
      entrypoint: "unstorage/drivers/null",
    },
  },
  output: "server",
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

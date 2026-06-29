import type { APIRoute } from "astro";

import packageJson from "../../package.json" with { type: "json" };

export const prerender = true;

/** Public semver probe for deploy planning — no authentication required. */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      version: packageJson.version,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );

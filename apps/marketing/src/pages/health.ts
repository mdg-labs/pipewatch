import type { APIRoute } from "astro";

import { flags } from "@pipewatch/config/edition";

export const prerender = true;

/** Public liveness probe — no authentication required. */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      status: "ok" as const,
      edition: flags.IS_CE ? ("ce" as const) : ("cloud" as const),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );

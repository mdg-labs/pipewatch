import type { Hono } from "hono";

/** Register the public liveness probe — no authentication required. */
export function registerHealthRoute(app: Hono): void {
  app.get("/health", (c) =>
    c.json(
      {
        status: "ok" as const,
        edition: "cloud" as const,
      },
      200,
    ),
  );
}

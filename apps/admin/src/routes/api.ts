import { Hono } from "hono";

/** Register JSON API routes under `/api/*`. */
export function registerApiRoutes(app: Hono): void {
  const api = new Hono();

  api.get("/v1/status", (c) =>
    c.json(
      {
        status: "ok" as const,
        service: "admin" as const,
      },
      200,
    ),
  );

  app.route("/api", api);
}

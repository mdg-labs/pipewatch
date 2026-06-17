import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { OPENAPI_SPEC_PATH } from "./routes/openapi.js";

describe("openapi integration", () => {
  it("serves a spec that documents /health", async () => {
    const app = createApp();
    const response = await app.request(OPENAPI_SPEC_PATH);

    expect(response.status).toBe(200);

    const spec = (await response.json()) as { paths?: Record<string, unknown> };
    expect(spec.paths).toBeDefined();
    expect(spec.paths).toHaveProperty("/health");
  });
});

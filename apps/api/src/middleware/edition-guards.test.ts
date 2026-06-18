import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiEnv } from "../types.js";

const editionMock = vi.hoisted(() => ({
  flags: {
    IS_CE: true,
    IS_CLOUD: false,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

import { requireCE, requireCloud } from "./edition-guards.js";

function createTestApp(middleware: typeof requireCloud | typeof requireCE): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.use("/guarded", middleware);
  app.get("/guarded", (c) => c.json({ ok: true }));
  return app;
}

describe("requireCloud", () => {
  beforeEach(() => {
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;
  });

  it("returns 404 on CE", async () => {
    const app = createTestApp(requireCloud);
    const response = await app.request("/guarded");

    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("allows Cloud requests through", async () => {
    editionMock.flags.IS_CE = false;
    editionMock.flags.IS_CLOUD = true;

    const app = createTestApp(requireCloud);
    const response = await app.request("/guarded");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("requireCE", () => {
  beforeEach(() => {
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;
  });

  it("returns 404 on Cloud", async () => {
    editionMock.flags.IS_CE = false;
    editionMock.flags.IS_CLOUD = true;

    const app = createTestApp(requireCE);
    const response = await app.request("/guarded");

    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("allows CE requests through", async () => {
    const app = createTestApp(requireCE);
    const response = await app.request("/guarded");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

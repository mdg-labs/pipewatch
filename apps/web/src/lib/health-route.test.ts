import { afterEach, describe, expect, it, vi } from "vitest";

const editionMock = vi.hoisted(() => ({
  flags: {
    IS_CE: true,
    IS_CLOUD: false,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

import { GET } from "../../app/health/route.js";

describe("GET /health", () => {
  afterEach(() => {
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;
  });

  it("returns ok status for CE", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      edition: "ce",
    });
  });

  it("returns ok status for cloud", async () => {
    editionMock.flags.IS_CE = false;
    editionMock.flags.IS_CLOUD = true;

    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      edition: "cloud",
    });
  });
});

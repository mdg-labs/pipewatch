import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const editionMock = vi.hoisted(() => ({
  flags: {
    BILLING_ENABLED: false,
    WAITLIST_ENABLED: false,
    BOOTSTRAP_ENABLED: true,
    IS_CE: true,
    IS_CLOUD: false,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

describe("edition route registration", () => {
  beforeEach(() => {
    vi.resetModules();
    editionMock.flags.BILLING_ENABLED = false;
    editionMock.flags.WAITLIST_ENABLED = false;
    editionMock.flags.BOOTSTRAP_ENABLED = true;
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not register billing or waitlist routes when flags are false", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    expect((await app.request("/billing/stub")).status).toBe(404);
    expect((await app.request("/waitlist/stub", { method: "POST" })).status).toBe(404);
  });

  it("registers billing and waitlist routes when cloud flags are true", async () => {
    editionMock.flags.BILLING_ENABLED = true;
    editionMock.flags.WAITLIST_ENABLED = true;
    editionMock.flags.BOOTSTRAP_ENABLED = false;
    editionMock.flags.IS_CE = false;
    editionMock.flags.IS_CLOUD = true;

    const { createApp } = await import("./app.js");
    const app = createApp();

    const billing = await app.request("/billing/stub");
    expect(billing.status).toBe(200);
    await expect(billing.json()).resolves.toEqual({ status: "cloud-only" });

    const waitlist = await app.request("/waitlist/stub", { method: "POST" });
    expect(waitlist.status).toBe(200);
    await expect(waitlist.json()).resolves.toEqual({ status: "cloud-only" });
  });

  it("returns 404 on CE even when cloud routes are registered", async () => {
    editionMock.flags.BILLING_ENABLED = true;
    editionMock.flags.WAITLIST_ENABLED = true;
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;

    const { createApp } = await import("./app.js");
    const app = createApp();

    expect((await app.request("/billing/stub")).status).toBe(404);
    expect((await app.request("/waitlist/stub", { method: "POST" })).status).toBe(404);
  });

  it("registers bootstrap route only when BOOTSTRAP_ENABLED is true", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    const setup = await app.request("/setup/stub");
    expect(setup.status).toBe(200);
    await expect(setup.json()).resolves.toEqual({ status: "ce-only" });
  });

  it("does not register bootstrap route when BOOTSTRAP_ENABLED is false", async () => {
    editionMock.flags.BOOTSTRAP_ENABLED = false;

    const { createApp } = await import("./app.js");
    const app = createApp();

    expect((await app.request("/setup/stub")).status).toBe(404);
  });
});

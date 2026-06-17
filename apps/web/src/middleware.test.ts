import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "./lib/auth-cookies";

const editionMock = vi.hoisted(() => ({
  flags: {
    BOOTSTRAP_ENABLED: true,
    IS_CE: true,
    IS_CLOUD: false,
  },
}));

const bootstrapMock = vi.hoisted(() => ({
  getBootstrapStatusForMiddleware: vi.fn(),
  clearBootstrapStatusCache: vi.fn(),
}));

vi.mock("@pipewatch/config/edition", () => editionMock);
vi.mock("./lib/bootstrap", () => bootstrapMock);

function createRequest(
  path: string,
  cookies?: Record<string, string>,
): NextRequest {
  const request = new NextRequest(`http://localhost:3000${path}`);
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      request.cookies.set(name, value);
    }
  }
  return request;
}

function setCeEdition(): void {
  editionMock.flags.BOOTSTRAP_ENABLED = true;
  editionMock.flags.IS_CE = true;
  editionMock.flags.IS_CLOUD = false;
}

function setCloudEdition(): void {
  editionMock.flags.BOOTSTRAP_ENABLED = false;
  editionMock.flags.IS_CE = false;
  editionMock.flags.IS_CLOUD = true;
}

describe("middleware bootstrap redirects", () => {
  beforeEach(() => {
    vi.resetModules();
    setCeEdition();
    bootstrapMock.getBootstrapStatusForMiddleware.mockReset();
    bootstrapMock.clearBootstrapStatusCache.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects unauthenticated CE app routes to /setup when bootstrap is required", async () => {
    bootstrapMock.getBootstrapStatusForMiddleware.mockResolvedValue({
      bootstrapRequired: true,
      userCount: 0,
    });

    const { middleware } = await import("./middleware");

    for (const path of ["/", "/workspaces/acme", "/sign-in"]) {
      const response = await middleware(createRequest(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `http://localhost:3000/setup`,
      );
    }
  });

  it("allows /setup through when CE bootstrap is required", async () => {
    bootstrapMock.getBootstrapStatusForMiddleware.mockResolvedValue({
      bootstrapRequired: true,
      userCount: 0,
    });

    const { middleware } = await import("./middleware");
    const response = await middleware(createRequest("/setup"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects /setup to /sign-in after CE bootstrap is complete", async () => {
    bootstrapMock.getBootstrapStatusForMiddleware.mockResolvedValue({
      bootstrapRequired: false,
      userCount: 1,
    });

    const { middleware } = await import("./middleware");
    const response = await middleware(createRequest("/setup"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in",
    );
  });

  it("redirects unauthenticated CE app routes to /sign-in after bootstrap", async () => {
    bootstrapMock.getBootstrapStatusForMiddleware.mockResolvedValue({
      bootstrapRequired: false,
      userCount: 1,
    });

    const { middleware } = await import("./middleware");
    const response = await middleware(createRequest("/workspaces/acme"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?next=%2Fworkspaces%2Facme",
    );
  });

  it("allows authenticated CE users through protected routes", async () => {
    bootstrapMock.getBootstrapStatusForMiddleware.mockResolvedValue({
      bootstrapRequired: false,
      userCount: 1,
    });

    const { middleware } = await import("./middleware");
    const response = await middleware(
      createRequest("/workspaces/acme", {
        [ACCESS_COOKIE_NAME]: "token",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("middleware cloud edition", () => {
  beforeEach(() => {
    vi.resetModules();
    setCloudEdition();
    bootstrapMock.getBootstrapStatusForMiddleware.mockReset();
  });

  it("never redirects cloud users to /setup", async () => {
    const { middleware } = await import("./middleware");
    const response = await middleware(createRequest("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?next=%2F",
    );
    expect(bootstrapMock.getBootstrapStatusForMiddleware).not.toHaveBeenCalled();
  });

  it("does not redirect cloud /setup to bootstrap", async () => {
    const { middleware } = await import("./middleware");
    const response = await middleware(createRequest("/setup"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(bootstrapMock.getBootstrapStatusForMiddleware).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated cloud protected routes to /sign-in", async () => {
    const { middleware } = await import("./middleware");
    const response = await middleware(createRequest("/workspaces/acme"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?next=%2Fworkspaces%2Facme",
    );
  });

  it("allows authenticated cloud users through protected routes", async () => {
    const { middleware } = await import("./middleware");
    const response = await middleware(
      createRequest("/", {
        [REFRESH_COOKIE_NAME]: "refresh-token",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

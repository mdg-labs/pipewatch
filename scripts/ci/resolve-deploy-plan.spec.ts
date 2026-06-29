import { describe, expect, it, vi } from "vitest";

import { BOOTSTRAP_VERSION, semverGt } from "./probe-version.mjs";
import {
  assertProbeOriginSecrets,
  createEmptyPlan,
  deriveSyncServices,
  formatGithubOutputs,
  gateAdminDeployWithoutDockerfile,
  PRODUCTION_MIN_VERSION,
  resolveApiProbeOrigin,
  resolveDeployPlan,
  resolveMarketingProbeOrigin,
  resolveWebProbeOrigin,
} from "./resolve-deploy-plan.mjs";

describe("resolveDeployPlan", () => {
  const packageVersions = {
    "@pipewatch/api": "1.0.1",
    "@pipewatch/worker": "1.0.1",
    "@pipewatch/web": "1.0.1",
    "@pipewatch/marketing": "1.0.1",
    "@pipewatch/admin": "1.0.1",
  };

  it("deploys when intended version is greater than live", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ version: "1.0.0" }),
    });

    const { plan, skipReasons } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "auto",
      packageVersions,
      origins: {
        api: "https://api.example.test",
        worker: "https://worker.example.test",
        web: "https://web.example.test",
        marketing: "https://marketing.example.test",
        admin: "https://admin.example.test",
      },
      fetchFn,
    });

    expect(plan.deploy_api).toBe(true);
    expect(plan.deploy_worker).toBe(true);
    expect(plan.deploy_web).toBe(true);
    expect(plan.run_migrate).toBe(true);
    expect(plan.push_ghcr_api).toBe(true);
    expect(plan.push_ghcr_worker).toBe(true);
    expect(plan.push_ghcr_web).toBe(true);
    expect(plan.deploy_marketing).toBe(true);
    expect(plan.deploy_admin).toBe(true);
    expect(plan.sync_services).toBe("api,worker,web,marketing,admin");
    expect(skipReasons).toHaveLength(0);
  });

  it("skips surfaces when live matches intended", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ version: "1.0.1" }),
    });

    const { plan, skipReasons } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "auto",
      packageVersions,
      origins: {
        api: "https://api.example.test",
        web: "https://web.example.test",
      },
      fetchFn,
    });

    expect(plan.deploy_api).toBe(false);
    expect(plan.deploy_web).toBe(false);
    expect(skipReasons.some((r) => r.includes("api:"))).toBe(true);
  });

  it("self-heals when live lags intended without new bump", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ version: "1.0.0" }),
    });

    const versions = { ...packageVersions, "@pipewatch/api": "1.0.1" };
    const { plan } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "auto",
      packageVersions: versions,
      origins: { api: "https://api.example.test" },
      fetchFn,
    });

    expect(plan.deploy_api).toBe(true);
    expect(plan.push_ghcr_api).toBe(true);
    expect(semverGt("1.0.1", "1.0.0")).toBe(true);
  });

  it("bootstraps unreachable live to 0.0.0 and deploys staging marketing", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const { plan } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "auto",
      packageVersions: { "@pipewatch/marketing": "0.2.0" },
      origins: { marketing: "https://marketing.example.test" },
      fetchFn,
      maxAttempts: 1,
      initialDelayMs: 1,
    });

    expect(plan.deploy_marketing).toBe(true);
  });

  it("manual mode skips live compare", async () => {
    const fetchFn = vi.fn();

    const { plan } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "manual",
      packageVersions: { "@pipewatch/web": "0.3.0" },
      origins: { web: "https://web.example.test" },
      fetchFn,
    });

    expect(plan.deploy_web).toBe(true);
    expect(plan.push_ghcr_web).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("production gate skips packages below 1.0.0", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ version: BOOTSTRAP_VERSION }),
    });

    const { plan, skipReasons } = await resolveDeployPlan({
      environment: "production",
      deployMode: "auto",
      packageVersions: { "@pipewatch/marketing": "0.9.9" },
      origins: {
        api: "https://api.example.test",
        web: "https://web.example.test",
        marketing: "https://marketing.example.test",
        admin: "https://admin.example.test",
      },
      fetchFn,
    });

    expect(plan.deploy_marketing).toBe(false);
    expect(
      skipReasons.some((reason) => reason.includes(PRODUCTION_MIN_VERSION)),
    ).toBe(true);
  });

  it("couples worker deploy to api when worker probe origin is missing", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ version: "1.0.0" }),
    });

    const { plan, log } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "auto",
      packageVersions: {
        "@pipewatch/api": "1.0.1",
        "@pipewatch/worker": "1.0.1",
      },
      origins: {
        api: "https://api.example.test",
      },
      fetchFn,
    });

    expect(plan.deploy_api).toBe(true);
    expect(plan.deploy_worker).toBe(true);
    expect(plan.push_ghcr_worker).toBe(true);
    expect(log.some((entry) => entry.includes("coupled to api"))).toBe(true);
  });

  it("skips worker coupling when api does not deploy", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ version: "1.0.1" }),
    });

    const { plan } = await resolveDeployPlan({
      environment: "staging",
      deployMode: "auto",
      packageVersions: {
        "@pipewatch/api": "1.0.1",
        "@pipewatch/worker": "1.0.1",
      },
      origins: {
        api: "https://api.example.test",
      },
      fetchFn,
    });

    expect(plan.deploy_api).toBe(false);
    expect(plan.deploy_worker).toBe(false);
  });

  it("formats GitHub outputs with deployed flags false in plan", () => {
    const plan = createEmptyPlan();
    plan.deploy_api = true;
    plan.deploy_worker = true;
    plan.sync_services = deriveSyncServices(plan);

    expect(formatGithubOutputs(plan)).toMatchObject({
      deploy_api: "true",
      deploy_worker: "true",
      push_ghcr_worker: "false",
      deployed_api: "false",
      deployed_web: "false",
      sync_services: "api,worker",
    });
  });
});

describe("probe origin fallbacks", () => {
  it("resolves api probe origin through APP_BASE_URL, API_ORIGIN, NEXT_PUBLIC_API_URL", () => {
    expect(
      resolveApiProbeOrigin({
        APP_BASE_URL: "https://app-base.example.test",
        API_ORIGIN: "https://api.example.test",
        NEXT_PUBLIC_API_URL: "https://fallback.example.test",
      }),
    ).toBe("https://app-base.example.test");

    expect(
      resolveApiProbeOrigin({
        API_ORIGIN: "https://api.example.test",
        NEXT_PUBLIC_API_URL: "https://fallback.example.test",
      }),
    ).toBe("https://api.example.test");

    expect(
      resolveApiProbeOrigin({
        NEXT_PUBLIC_API_URL: "https://fallback.example.test",
      }),
    ).toBe("https://fallback.example.test");
  });

  it("resolves web probe origin from FRONTEND_ORIGIN or APP_URL", () => {
    expect(
      resolveWebProbeOrigin({
        FRONTEND_ORIGIN: "https://web.example.test",
        APP_URL: "https://app.example.test",
      }),
    ).toBe("https://web.example.test");

    expect(resolveWebProbeOrigin({ APP_URL: "https://app.example.test" })).toBe(
      "https://app.example.test",
    );
  });

  it("resolves marketing probe origin from MARKETING_ORIGIN or MARKETING_URL", () => {
    expect(
      resolveMarketingProbeOrigin({
        MARKETING_ORIGIN: "https://marketing.example.test",
        MARKETING_URL: "https://marketing-url.example.test",
      }),
    ).toBe("https://marketing.example.test");

    expect(
      resolveMarketingProbeOrigin({ MARKETING_URL: "https://marketing-url.example.test" }),
    ).toBe("https://marketing-url.example.test");
  });

  it("throws in auto mode when probe origin secrets are missing", () => {
    expect(() =>
      assertProbeOriginSecrets({
        deployMode: "auto",
        env: {},
      }),
    ).toThrow(/missing GHA probe origin secrets/);

    expect(() =>
      assertProbeOriginSecrets({
        deployMode: "auto",
        env: {
          NEXT_PUBLIC_API_URL: "https://api.example.test",
          APP_URL: "https://web.example.test",
          MARKETING_URL: "https://marketing.example.test",
        },
      }),
    ).not.toThrow();
  });

  it("allows missing probe origins in manual mode", () => {
    expect(() =>
      assertProbeOriginSecrets({
        deployMode: "manual",
        env: {},
      }),
    ).not.toThrow();
  });
});

describe("gateAdminDeployWithoutDockerfile", () => {
  it("clears admin deploy flags when apps/admin/Dockerfile is absent", () => {
    const plan = createEmptyPlan();
    plan.deploy_admin = true;
    plan.run_migrate_admin = true;
    plan.sync_services = "admin";
    const skipReasons: string[] = [];
    const log: string[] = [];

    gateAdminDeployWithoutDockerfile(
      plan,
      skipReasons,
      log,
      "/tmp/nonexistent-repo-without-admin-dockerfile",
    );

    expect(plan.deploy_admin).toBe(false);
    expect(plan.run_migrate_admin).toBe(false);
    expect(plan.sync_services).toBe("none");
    expect(skipReasons.some((reason) => reason.includes("apps/admin/Dockerfile"))).toBe(
      true,
    );
  });
});

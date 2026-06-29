/**
 * Deploy plan from live /version probes (PRD §22).
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEPLOYABLE_DIRS,
  PACKAGE_DIR_TO_NAME,
} from "../lib/package-version-policy.mjs";
import {
  BOOTSTRAP_VERSION,
  probeLiveVersion,
  semverGt,
  semverGte,
} from "./probe-version.mjs";

/** @typedef {'staging' | 'production'} DeployEnvironment */

/** @typedef {'auto' | 'manual'} DeployMode */

/**
 * @typedef {object} DeployPlan
 * @property {boolean} deploy_api
 * @property {boolean} deploy_worker
 * @property {boolean} deploy_web
 * @property {boolean} deploy_marketing
 * @property {boolean} deploy_admin
 * @property {boolean} run_migrate
 * @property {boolean} run_migrate_admin
 * @property {boolean} push_ghcr_api
 * @property {boolean} push_ghcr_worker
 * @property {boolean} push_ghcr_web
 * @property {string} sync_services
 * @property {boolean} deployed_api
 * @property {boolean} deployed_web
 */

/**
 * @typedef {object} SurfaceConfig
 * @property {string} id
 * @property {string} packageName
 * @property {string} pkgDir
 * @property {keyof DeployPlan} deployFlag
 * @property {Array<keyof DeployPlan>} relatedFlags
 */

export const PRODUCTION_MIN_VERSION = "1.0.0";

const ADMIN_DOCKERFILE = "apps/admin/Dockerfile";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveApiProbeOrigin(env) {
  const appBaseUrl = env.APP_BASE_URL?.trim();
  if (appBaseUrl) {
    return appBaseUrl;
  }
  const apiOrigin = env.API_ORIGIN?.trim();
  if (apiOrigin) {
    return apiOrigin;
  }
  return env.NEXT_PUBLIC_API_URL?.trim() ?? "";
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveWebProbeOrigin(env) {
  const frontendOrigin = env.FRONTEND_ORIGIN?.trim();
  if (frontendOrigin) {
    return frontendOrigin;
  }
  return env.APP_URL?.trim() ?? "";
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveMarketingProbeOrigin(env) {
  const marketingOrigin = env.MARKETING_ORIGIN?.trim();
  if (marketingOrigin) {
    return marketingOrigin;
  }
  return env.MARKETING_URL?.trim() ?? "";
}

/**
 * Fail fast when GHA probe-origin secrets are missing in auto deploy mode.
 *
 * @param {object} input
 * @param {DeployMode} input.deployMode
 * @param {Record<string, string | undefined>} input.env
 */
export function assertProbeOriginSecrets(input) {
  if (input.deployMode !== "auto") {
    return;
  }

  /** @type {string[]} */
  const missing = [];
  if (!resolveApiProbeOrigin(input.env)) {
    missing.push("APP_BASE_URL, API_ORIGIN, or NEXT_PUBLIC_API_URL");
  }
  if (!resolveWebProbeOrigin(input.env)) {
    missing.push("FRONTEND_ORIGIN or APP_URL");
  }
  if (!resolveMarketingProbeOrigin(input.env)) {
    missing.push("MARKETING_ORIGIN or MARKETING_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `resolve-deploy-plan: missing GHA probe origin secrets (${missing.join("; ")}) — set Phase-synced secrets on the GHA environment (not vars.*)`,
    );
  }
}

/** @type {SurfaceConfig[]} */
export const SURFACES = [
  {
    id: "api",
    packageName: "@pipewatch/api",
    pkgDir: "apps/api",
    deployFlag: "deploy_api",
    relatedFlags: ["run_migrate", "push_ghcr_api"],
  },
  {
    id: "worker",
    packageName: "@pipewatch/worker",
    pkgDir: "apps/worker",
    deployFlag: "deploy_worker",
    relatedFlags: ["push_ghcr_worker"],
  },
  {
    id: "web",
    packageName: "@pipewatch/web",
    pkgDir: "apps/web",
    deployFlag: "deploy_web",
    relatedFlags: ["push_ghcr_web"],
  },
  {
    id: "marketing",
    packageName: "@pipewatch/marketing",
    pkgDir: "apps/marketing",
    deployFlag: "deploy_marketing",
    relatedFlags: [],
  },
  {
    id: "admin",
    packageName: "@pipewatch/admin",
    pkgDir: "apps/admin",
    deployFlag: "deploy_admin",
    relatedFlags: ["run_migrate_admin"],
  },
];

/**
 * @returns {DeployPlan}
 */
export function createEmptyPlan() {
  return {
    deploy_api: false,
    deploy_worker: false,
    deploy_web: false,
    deploy_marketing: false,
    deploy_admin: false,
    run_migrate: false,
    run_migrate_admin: false,
    push_ghcr_api: false,
    push_ghcr_worker: false,
    push_ghcr_web: false,
    sync_services: "",
    deployed_api: false,
    deployed_web: false,
  };
}

/**
 * @param {DeployPlan} plan
 * @returns {string}
 */
export function deriveSyncServices(plan) {
  /** @type {string[]} */
  const services = [];
  if (plan.deploy_api) {
    services.push("api");
  }
  if (plan.deploy_worker) {
    services.push("worker");
  }
  if (plan.deploy_web) {
    services.push("web");
  }
  if (plan.deploy_marketing) {
    services.push("marketing");
  }
  if (plan.deploy_admin) {
    services.push("admin");
  }
  return services.join(",");
}

/**
 * Skip admin deploy when the Fly image is not yet available.
 *
 * @param {DeployPlan} plan
 * @param {string[]} skipReasons
 * @param {string[]} log
 * @param {string} repoRoot
 */
export function gateAdminDeployWithoutDockerfile(plan, skipReasons, log, repoRoot) {
  if (!plan.deploy_admin) {
    return;
  }

  const dockerfilePath = join(repoRoot, ADMIN_DOCKERFILE);
  if (existsSync(dockerfilePath)) {
    return;
  }

  plan.deploy_admin = false;
  plan.run_migrate_admin = false;
  const reason = "admin: skipped — apps/admin/Dockerfile missing (Fly deploy not configured)";
  skipReasons.push(reason);
  log.push(reason);
  plan.sync_services = deriveSyncServices(plan) || "none";
}

/**
 * @param {string} repoRoot
 * @returns {Record<string, string>}
 */
export function readDeployableVersions(repoRoot) {
  /** @type {Record<string, string>} */
  const versions = {};
  for (const pkgDir of DEPLOYABLE_DIRS) {
    const manifestPath = join(repoRoot, pkgDir, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const name = manifest.name ?? PACKAGE_DIR_TO_NAME[pkgDir];
    if (name && manifest.version) {
      versions[name] = manifest.version;
    }
  }
  return versions;
}

/**
 * @param {DeployPlan} plan
 * @param {SurfaceConfig} surface
 * @param {boolean} shouldDeploy
 */
function setSurfaceDeploy(plan, surface, shouldDeploy) {
  plan[surface.deployFlag] = shouldDeploy;
  for (const flag of surface.relatedFlags) {
    plan[flag] = shouldDeploy;
  }
}

/**
 * @param {object} input
 * @param {DeployEnvironment} input.environment
 * @param {DeployMode} input.deployMode
 * @param {Record<string, string>} input.packageVersions
 * @param {Record<string, string | undefined>} input.origins
 * @param {typeof fetch} [input.fetchFn]
 * @param {string} [input.cfAccessClientId]
 * @param {string} [input.cfAccessClientSecret]
 * @param {number} [input.maxAttempts]
 * @param {number} [input.initialDelayMs]
 * @param {string} [input.repoRoot]
 * @returns {Promise<{ plan: DeployPlan; skipReasons: string[]; log: string[] }>}
 */
export async function resolveDeployPlan(input) {
  const plan = createEmptyPlan();
  /** @type {string[]} */
  const skipReasons = [];
  /** @type {string[]} */
  const log = [];

  for (const surface of SURFACES) {
    const intended =
      input.packageVersions[surface.packageName] ?? BOOTSTRAP_VERSION;
    const origin = input.origins[surface.id]?.trim();

    if (!origin) {
      if (surface.id === "worker") {
        log.push(
          `${surface.id}: live probe skipped — no WORKER_PROBE_URL (GHA cannot reach Fly 6PN)`,
        );
        continue;
      }
      const reason = `${surface.id}: skipped — missing origin URL`;
      skipReasons.push(reason);
      log.push(reason);
      continue;
    }

    if (
      input.environment === "production" &&
      !semverGte(intended, PRODUCTION_MIN_VERSION)
    ) {
      const reason = `${surface.id}: skipped — ${surface.packageName}@${intended} < ${PRODUCTION_MIN_VERSION} (production gate)`;
      skipReasons.push(reason);
      log.push(reason);
      continue;
    }

    if (input.deployMode === "manual") {
      setSurfaceDeploy(plan, surface, true);
      log.push(`${surface.id}: deploy (manual mode — live compare skipped)`);
      continue;
    }

    const probe = await probeLiveVersion({
      origin,
      environment: input.environment,
      cfAccessClientId: input.cfAccessClientId,
      cfAccessClientSecret: input.cfAccessClientSecret,
      fetchFn: input.fetchFn,
      maxAttempts: input.maxAttempts,
      initialDelayMs: input.initialDelayMs,
    });

    if (probe.bootstrapped) {
      log.push(
        `${surface.id}: live version unreachable — bootstrapped ${BOOTSTRAP_VERSION}`,
      );
    } else {
      log.push(`${surface.id}: live version ${probe.liveVersion}`);
    }

    if (semverGt(intended, probe.liveVersion)) {
      setSurfaceDeploy(plan, surface, true);
      log.push(
        `${surface.id}: deploy — intended ${intended} > live ${probe.liveVersion}`,
      );
    } else {
      const reason = `${surface.id}: skipped — intended ${intended} <= live ${probe.liveVersion}`;
      skipReasons.push(reason);
      log.push(reason);
    }
  }

  const workerSurface = SURFACES.find((surface) => surface.id === "worker");
  if (
    workerSurface &&
    !input.origins.worker?.trim() &&
    plan.deploy_api &&
    !plan.deploy_worker
  ) {
    setSurfaceDeploy(plan, workerSurface, true);
    log.push(
      "worker: deploy (coupled to api — private /version probe unavailable from GHA)",
    );
  }

  if (input.repoRoot) {
    gateAdminDeployWithoutDockerfile(plan, skipReasons, log, input.repoRoot);
  }

  plan.sync_services = deriveSyncServices(plan) || "none";
  return { plan, skipReasons, log };
}

/**
 * @param {DeployPlan} plan
 * @returns {Record<string, string>}
 */
export function formatGithubOutputs(plan) {
  return {
    deploy_api: String(plan.deploy_api),
    deploy_worker: String(plan.deploy_worker),
    deploy_web: String(plan.deploy_web),
    deploy_marketing: String(plan.deploy_marketing),
    deploy_admin: String(plan.deploy_admin),
    run_migrate: String(plan.run_migrate),
    run_migrate_admin: String(plan.run_migrate_admin),
    push_ghcr_api: String(plan.push_ghcr_api),
    push_ghcr_worker: String(plan.push_ghcr_worker),
    push_ghcr_web: String(plan.push_ghcr_web),
    sync_services: plan.sync_services || "none",
    deployed_api: String(plan.deployed_api),
    deployed_web: String(plan.deployed_web),
  };
}

/**
 * @param {DeployPlan} plan
 * @param {string[]} skipReasons
 */
export function writeGithubOutput(plan, skipReasons) {
  const outputs = formatGithubOutputs(plan);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) {
    for (const [key, value] of Object.entries(outputs)) {
      process.stdout.write(`${key}=${value}\n`);
    }
    return;
  }
  for (const [key, value] of Object.entries(outputs)) {
    appendFileSync(githubOutput, `${key}=${value}\n`);
  }
  appendFileSync(githubOutput, `skip_reasons<<EOF\n${skipReasons.join("\n")}\nEOF\n`);
}

/**
 * CLI entry for deploy-plan workflows.
 */
export async function main() {
  const environment = process.env.ENVIRONMENT;
  if (environment !== "staging" && environment !== "production") {
    throw new Error("resolve-deploy-plan: ENVIRONMENT must be staging or production");
  }

  const deployModeRaw = process.env.DEPLOY_MODE ?? "auto";
  const deployMode = deployModeRaw === "manual" ? "manual" : "auto";
  const shouldDeploy = (process.env.SHOULD_DEPLOY ?? "true") !== "false";

  if (!shouldDeploy) {
    const plan = createEmptyPlan();
    plan.sync_services = "all";
    const skipReasons = ["should_deploy=false — sync only"];
    for (const line of skipReasons) {
      process.stderr.write(`resolve-deploy-plan: ${line}\n`);
    }
    writeGithubOutput(plan, skipReasons);
    return;
  }

  const forceManual =
    process.env.FORCE_FULL_DEPLOY === "true" || deployMode === "manual";
  const effectiveMode = forceManual ? "manual" : "auto";

  const repoRoot = process.cwd();
  const packageVersions = readDeployableVersions(repoRoot);

  assertProbeOriginSecrets({ deployMode: effectiveMode, env: process.env });

  const origins = {
    api: resolveApiProbeOrigin(process.env),
    worker: process.env.WORKER_PROBE_URL,
    web: resolveWebProbeOrigin(process.env),
    marketing: resolveMarketingProbeOrigin(process.env),
    admin: process.env.ADMIN_URL,
  };

  const { plan, skipReasons, log } = await resolveDeployPlan({
    environment,
    deployMode: effectiveMode,
    packageVersions,
    origins,
    cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
    repoRoot,
  });

  for (const entry of log) {
    process.stderr.write(`resolve-deploy-plan: ${entry}\n`);
  }

  writeGithubOutput(plan, skipReasons);
}

const isMain = process.argv[1]?.endsWith("resolve-deploy-plan.mjs");
if (isMain) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}

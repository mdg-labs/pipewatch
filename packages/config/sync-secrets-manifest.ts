/**
 * Single source of truth for hosted secret sync — per-service keys, GHA storage
 * names, and derived values. Validated against env.ts strict fields,
 * sync-secrets.yml, and sync-secrets.sh (PRD §10, §23).
 */

/** Phase / GHA storage key → Fly / runtime key (sync boundary only). */
export const GITHUB_STORAGE_TO_RUNTIME = {
  GH_APP_ID: "GITHUB_APP_ID",
  GH_APP_PRIVATE_KEY: "GITHUB_APP_PRIVATE_KEY",
  GH_WEBHOOK_SECRET: "GITHUB_WEBHOOK_SECRET",
  GH_CLIENT_ID: "GITHUB_CLIENT_ID",
  GH_CLIENT_SECRET: "GITHUB_CLIENT_SECRET",
  GH_APP_SLUG: "GITHUB_APP_SLUG",
} as const satisfies Record<string, string>;

export type GithubStorageKey = keyof typeof GITHUB_STORAGE_TO_RUNTIME;
export type GithubRuntimeKey =
  (typeof GITHUB_STORAGE_TO_RUNTIME)[GithubStorageKey];

export type SyncService = "api" | "worker" | "web" | "marketing";
export type SyncDeployTarget = "fly" | "wrangler";

export type SecretSource = "gha" | "derived";

export interface SyncSecretEntry {
  /** Variable name on Fly.io / Cloudflare Workers at runtime. */
  runtimeKey: string;
  /** Where the value comes from during sync. */
  source: SecretSource;
  /**
   * Phase / GitHub Actions `secrets.*` name when it differs from `runtimeKey`
   * (e.g. `GH_APP_ID` stored in GHA, `GITHUB_APP_ID` on Fly).
   */
  ghaStorageKey?: string;
  /** Fail sync preflight when empty in the GHA environment (staging/production). */
  required: boolean;
  /** Required only when `PIPEWATCH_EDITION=cloud`. */
  cloudOnly?: boolean;
}

export interface ServiceSyncManifest {
  service: SyncService;
  deployTarget: SyncDeployTarget;
  secrets: readonly SyncSecretEntry[];
}

function gha(
  runtimeKey: string,
  options: {
    required?: boolean;
    cloudOnly?: boolean;
    ghaStorageKey?: string;
  } = {},
): SyncSecretEntry {
  const { required = false, cloudOnly, ghaStorageKey } = options;
  return {
    runtimeKey,
    source: "gha",
    ...(ghaStorageKey !== undefined ? { ghaStorageKey } : {}),
    required,
    ...(cloudOnly !== undefined ? { cloudOnly } : {}),
  };
}

function derived(runtimeKey: string, required = false): SyncSecretEntry {
  return { runtimeKey, source: "derived", required };
}

function github(
  storageKey: GithubStorageKey,
  options: { required?: boolean; cloudOnly?: boolean } = {},
): SyncSecretEntry {
  return gha(GITHUB_STORAGE_TO_RUNTIME[storageKey], {
    ghaStorageKey: storageKey,
    required: options.required ?? false,
    ...(options.cloudOnly !== undefined ? { cloudOnly: options.cloudOnly } : {}),
  });
}

/** Per-service secret sync manifest for staging/production deploys. */
export const SYNC_SECRETS_MANIFEST: readonly ServiceSyncManifest[] = [
  {
    service: "api",
    deployTarget: "fly",
    secrets: [
      gha("NODE_ENV"),
      gha("PIPEWATCH_EDITION"),
      gha("DATABASE_URL", { required: true }),
      derived("REDIS_URL", true),
      gha("ENCRYPTION_KEY", { required: true }),
      gha("SENTRY_DSN"),
      gha("JWT_SECRET", { required: true }),
      gha("JWT_REFRESH_SECRET", { required: true }),
      github("GH_APP_ID", { required: true }),
      github("GH_APP_PRIVATE_KEY", { required: true }),
      github("GH_WEBHOOK_SECRET", { required: true }),
      github("GH_CLIENT_ID", { required: true }),
      github("GH_CLIENT_SECRET", { required: true }),
      github("GH_APP_SLUG", { required: true }),
      gha("APP_URL", { required: true }),
      gha("MARKETING_URL", { required: true }),
      gha("SMTP_HOST"),
      gha("SMTP_PORT"),
      gha("SMTP_USER"),
      gha("SMTP_PASS"),
      gha("SMTP_FROM"),
      gha("POSTMARK_API_KEY"),
      gha("POSTMARK_BROADCAST_STREAM"),
      gha("POSTMARK_WEBHOOK_SECRET", { required: true, cloudOnly: true }),
      gha("STRIPE_SECRET_KEY", { required: true, cloudOnly: true }),
      gha("STRIPE_WEBHOOK_SECRET", { required: true, cloudOnly: true }),
      gha("STRIPE_PRICE_PRO", { required: true, cloudOnly: true }),
      gha("STRIPE_PRICE_BUSINESS", { required: true, cloudOnly: true }),
      gha("PIPEWATCH_MODE"),
    ],
  },
  {
    service: "worker",
    deployTarget: "fly",
    secrets: [
      gha("NODE_ENV"),
      gha("PIPEWATCH_EDITION"),
      gha("DATABASE_URL", { required: true }),
      derived("REDIS_URL", true),
      gha("ENCRYPTION_KEY", { required: true }),
      gha("SENTRY_DSN"),
      github("GH_APP_ID", { required: true }),
      github("GH_APP_PRIVATE_KEY", { required: true }),
      gha("PIPEWATCH_MODE"),
      gha("RETENTION_DAYS"),
    ],
  },
  {
    service: "web",
    deployTarget: "wrangler",
    secrets: [
      gha("NODE_ENV"),
      gha("PIPEWATCH_EDITION"),
      gha("NEXT_PUBLIC_API_URL", { required: true }),
      gha("SENTRY_DSN"),
    ],
  },
  {
    service: "marketing",
    deployTarget: "wrangler",
    secrets: [
      gha("NODE_ENV"),
      gha("PIPEWATCH_EDITION"),
      gha("LAUNCH_MODE"),
      gha("NEXT_PUBLIC_APP_URL"),
      gha("SENTRY_DSN"),
      gha("UMAMI_SCRIPT_URL", { required: true, cloudOnly: true }),
      gha("UMAMI_WEBSITE_ID", { required: true, cloudOnly: true }),
    ],
  },
] as const;

/** Workflow-only credentials — not app runtime env, but required for sync/deploy. */
export const SYNC_WORKFLOW_SECRETS = [
  "FLY_API_TOKEN",
  "CF_API_TOKEN",
  "CF_ACCOUNT_ID",
] as const;

export function getServiceManifest(
  service: SyncService,
): ServiceSyncManifest | undefined {
  return SYNC_SECRETS_MANIFEST.find((entry) => entry.service === service);
}

/** Resolve the Phase/GHA storage key for a manifest entry. */
export function resolveGhaStorageKey(entry: SyncSecretEntry): string {
  if (entry.source === "derived") {
    return entry.runtimeKey;
  }
  return entry.ghaStorageKey ?? entry.runtimeKey;
}

/** Runtime keys pushed to Fly/Wrangler for a service. */
export function runtimeKeysForService(service: SyncService): string[] {
  const manifest = getServiceManifest(service);
  if (!manifest) {
    return [];
  }
  return manifest.secrets.map((entry) => entry.runtimeKey);
}

/** Phase/GHA keys that must appear in sync-secrets.yml (excludes derived). */
export function ghaStorageKeysFromManifest(): string[] {
  const keys = new Set<string>();
  for (const { secrets } of SYNC_SECRETS_MANIFEST) {
    for (const entry of secrets) {
      if (entry.source === "derived") {
        continue;
      }
      keys.add(resolveGhaStorageKey(entry));
    }
  }
  return [...keys].sort();
}

/** Required GHA storage keys for preflight (optionally cloud-only subset). */
export function requiredGhaStorageKeys(
  service: SyncService,
  edition: "ce" | "cloud",
): string[] {
  const manifest = getServiceManifest(service);
  if (!manifest) {
    return [];
  }

  return manifest.secrets
    .filter((entry) => {
      if (entry.source === "derived" || !entry.required) {
        return false;
      }
      if (entry.cloudOnly && edition !== "cloud") {
        return false;
      }
      return true;
    })
    .map((entry) => resolveGhaStorageKey(entry));
}

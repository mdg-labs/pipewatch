#!/usr/bin/env node
/**
 * Assert sync-secrets-manifest.ts stays aligned with env.ts strict fields,
 * sync-secrets.yml GHA mappings, sync-secrets.sh runtime arrays, and
 * github-secret-map.sh storage→runtime pairs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ADMIN_STRICT_FIELDS,
  API_CLOUD_STRICT_FIELDS,
  API_STRICT_FIELDS,
  MARKETING_CLOUD_STRICT_FIELDS,
  WEB_STRICT_FIELDS,
  WORKER_STRICT_FIELDS,
} from "../packages/config/strict-env-fields.ts";
import {
  GITHUB_STORAGE_TO_RUNTIME,
  SENTRY_STORAGE_BY_SERVICE,
  SYNC_SECRETS_MANIFEST,
  SYNC_WORKFLOW_SECRETS,
  requiredGhaStorageKeys,
  resolveGhaStorageKey,
  type SyncService,
} from "../packages/config/sync-secrets-manifest.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const SERVICE_SHELL_ARRAYS: Record<
  SyncService,
  readonly string[]
> = {
  api: ["API_FLY_KEYS"],
  worker: ["WORKER_FLY_KEYS"],
  web: ["WEB_WRANGLER_KEYS"],
  marketing: ["MARKETING_WRANGLER_KEYS"],
  admin: ["ADMIN_FLY_KEYS"],
};

export type ValidationIssue = {
  code: string;
  message: string;
};

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/** Extract `secrets.KEY` names from sync-secrets.yml env block. */
export function parseSyncSecretsYamlKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const pattern = /^\s+([A-Z0-9_]+):\s+\$\{\{\s*secrets\.\1\s*\}\}/gm;
  for (const match of content.matchAll(pattern)) {
    keys.add(match[1]!);
  }
  return keys;
}

/** Extract bash array keys from `NAME=( ... )` blocks in sync-secrets.sh. */
export function parseSyncSecretsShellArrayKeys(
  content: string,
  arrayName: string,
): Set<string> {
  const blockPattern = new RegExp(
    `${arrayName}=\\(\\s*([\\s\\S]*?)\\s*\\)`,
    "m",
  );
  const blockMatch = content.match(blockPattern);
  if (!blockMatch) {
    return new Set();
  }

  const keys = new Set<string>();
  const keyPattern = /^\s*([A-Z0-9_]+)\s*$/gm;
  for (const match of blockMatch[1]!.matchAll(keyPattern)) {
    keys.add(match[1]!);
  }
  return keys;
}

/** Parse `service)` branches from map_sentry_storage_to_runtime in github-secret-map.sh. */
export function parseSentryStorageMapServices(content: string): Map<string, string> {
  const pairs = new Map<string, string>();
  const fnMatch = content.match(
    /map_sentry_storage_to_runtime\(\)\s*\{([\s\S]*?)\n\}/,
  );
  if (!fnMatch) {
    return pairs;
  }

  for (const match of fnMatch[1]!.matchAll(
    /^\s*(api|worker|web|admin)\)\s*[\s\S]*?SENTRY_DSN="?\$\{([^}]+)\}/gm,
  )) {
    pairs.set(match[1]!, match[2]!);
  }
  return pairs;
}

/** Parse `service)` branches from github-secret-map.sh. */
export function parseGithubSecretMapPairs(content: string): Map<string, string> {
  const pairs = new Map<string, string>();
  const pattern = /^\s*([A-Z0-9_]+):([A-Z0-9_]+)\s*,?\s*$/gm;
  for (const match of content.matchAll(pattern)) {
    pairs.set(match[1]!, match[2]!);
  }
  return pairs;
}

function strictFieldsForService(service: SyncService): {
  base: readonly string[];
  cloud: readonly string[];
} {
  switch (service) {
    case "api":
      return { base: API_STRICT_FIELDS, cloud: API_CLOUD_STRICT_FIELDS };
    case "worker":
      return { base: WORKER_STRICT_FIELDS, cloud: [] };
    case "web":
      return { base: WEB_STRICT_FIELDS, cloud: [] };
    case "marketing":
      return { base: [], cloud: MARKETING_CLOUD_STRICT_FIELDS };
    case "admin":
      return { base: ADMIN_STRICT_FIELDS, cloud: [] };
  }
}

function getServiceManifest(service: SyncService) {
  return SYNC_SECRETS_MANIFEST.find((entry) => entry.service === service);
}

function extractPreflightBody(content: string): string {
  const match = content.match(
    /preflight_required_gha_keys\(\)\s*\{([\s\S]*?)\n\}\n\nrun_service_preflight\(\)/,
  );
  return match?.[1] ?? "";
}

/** Extract required GHA keys listed in sync-secrets.sh preflight case blocks. */
export function parsePreflightGhaKeys(
  content: string,
  service: SyncService,
): Set<string> {
  const preflightBody = extractPreflightBody(content);
  if (!preflightBody) {
    return new Set();
  }

  const casePattern = new RegExp(
    `${service}\\)[\\s\\S]*?(?=\\n\\s{4}[a-z]+\\)|\\n\\s{4}\\*\\)|\\n\\s*esac)`,
    "m",
  );
  const caseMatch = preflightBody.match(casePattern);
  if (!caseMatch) {
    return new Set();
  }

  const keys = new Set<string>();
  const keyPattern = /^\s*([A-Z0-9_]+)\s*$/gm;
  for (const match of caseMatch[0].matchAll(keyPattern)) {
    keys.add(match[1]!);
  }
  return keys;
}

function preflightListsKey(preflightBody: string, key: string): boolean {
  if (new RegExp(`^\\s*${key}\\s*$`, "m").test(preflightBody)) {
    return true;
  }

  return new RegExp(`keys=\\([^)]*\\b${key}\\b`, "m").test(preflightBody);
}

function validatePreflightKeys(
  shellContent: string,
  issues: ValidationIssue[],
): void {
  const preflightBody = extractPreflightBody(shellContent);
  if (!preflightBody) {
    issues.push({
      code: "preflight-missing-function",
      message: "sync-secrets.sh missing preflight_required_gha_keys function",
    });
    return;
  }

  for (const edition of ["ce", "cloud"] as const) {
    for (const service of ["api", "worker", "web", "marketing", "admin"] as const) {
      for (const key of requiredGhaStorageKeys(service, edition)) {
        if (!preflightListsKey(preflightBody, key)) {
          issues.push({
            code: "preflight-missing-key",
            message: `sync-secrets.sh preflight missing required GHA key ${key} for ${service} (${edition})`,
          });
        }
      }
    }
  }
}

function manifestRuntimeKeys(service: SyncService): Set<string> {
  const manifest = getServiceManifest(service);
  return new Set(manifest?.secrets.map((entry) => entry.runtimeKey) ?? []);
}

function manifestRequiredRuntimeKeys(service: SyncService): Set<string> {
  const manifest = getServiceManifest(service);
  const keys = new Set<string>();
  for (const entry of manifest?.secrets ?? []) {
    if (entry.required) {
      keys.add(entry.runtimeKey);
    }
  }
  return keys;
}

function manifestGhaStorageKeys(): Set<string> {
  const keys = new Set<string>();
  for (const { secrets } of SYNC_SECRETS_MANIFEST) {
    for (const entry of secrets) {
      if (entry.source === "derived") {
        continue;
      }
      keys.add(resolveGhaStorageKey(entry));
    }
  }
  return keys;
}

function manifestDerivedRuntimeKeys(): Set<string> {
  const keys = new Set<string>();
  for (const { secrets } of SYNC_SECRETS_MANIFEST) {
    for (const entry of secrets) {
      if (entry.source === "derived") {
        keys.add(entry.runtimeKey);
      }
    }
  }
  return keys;
}

export function validateSyncSecretsManifest(options: {
  yamlContent: string;
  shellContent: string;
  githubMapContent: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const yamlKeys = parseSyncSecretsYamlKeys(options.yamlContent);
  const ghaFromManifest = manifestGhaStorageKeys();
  const derivedRuntime = manifestDerivedRuntimeKeys();

  for (const workflowSecret of SYNC_WORKFLOW_SECRETS) {
    if (!yamlKeys.has(workflowSecret)) {
      issues.push({
        code: "yaml-missing-workflow-secret",
        message: `sync-secrets.yml missing workflow secret mapping: ${workflowSecret}`,
      });
    }
  }

  for (const storageKey of ghaFromManifest) {
    if (!yamlKeys.has(storageKey)) {
      issues.push({
        code: "yaml-missing-gha-key",
        message: `sync-secrets.yml missing GHA secret mapping: ${storageKey}`,
      });
    }
  }

  for (const yamlKey of yamlKeys) {
    if (
      SYNC_WORKFLOW_SECRETS.includes(
        yamlKey as (typeof SYNC_WORKFLOW_SECRETS)[number],
      )
    ) {
      continue;
    }
    if (!ghaFromManifest.has(yamlKey)) {
      issues.push({
        code: "yaml-extra-key",
        message: `sync-secrets.yml maps undeclared GHA secret: ${yamlKey}`,
      });
    }
  }

  for (const derivedKey of derivedRuntime) {
    if (yamlKeys.has(derivedKey)) {
      issues.push({
        code: "yaml-derived-forbidden",
        message: `sync-secrets.yml must not map derived secret ${derivedKey} from GHA`,
      });
    }
  }

  const githubPairs = parseGithubSecretMapPairs(options.githubMapContent);
  for (const [storageKey, runtimeKey] of Object.entries(
    GITHUB_STORAGE_TO_RUNTIME,
  )) {
    if (githubPairs.get(storageKey) !== runtimeKey) {
      issues.push({
        code: "github-map-drift",
        message: `github-secret-map.sh must map ${storageKey} → ${runtimeKey}`,
      });
    }
  }

  for (const [storageKey, runtimeKey] of githubPairs) {
    const expected = GITHUB_STORAGE_TO_RUNTIME[
      storageKey as keyof typeof GITHUB_STORAGE_TO_RUNTIME
    ];
    if (expected !== runtimeKey) {
      issues.push({
        code: "github-map-extra",
        message: `github-secret-map.sh has unexpected pair ${storageKey}:${runtimeKey}`,
      });
    }
  }

  const sentryPairs = parseSentryStorageMapServices(options.githubMapContent);
  for (const [service, mapping] of Object.entries(SENTRY_STORAGE_BY_SERVICE)) {
    const expectedStorage = mapping.storageKey;
    const actualStorage = sentryPairs.get(service);
    if (actualStorage !== expectedStorage) {
      issues.push({
        code: "sentry-map-drift",
        message: `github-secret-map.sh must map ${service} SENTRY_DSN from ${expectedStorage}`,
      });
    }
    if (
      !new RegExp(
        `map_sentry_storage_to_runtime ${service}[\\s\\n]*sync_(fly_secrets|wrangler)`,
        "m",
      ).test(options.shellContent) &&
      !new RegExp(
        `map_sentry_storage_to_runtime ${service}[\\s\\S]*?for key in "\\$\\{WEB_WRANGLER_KEYS`,
        "m",
      ).test(options.shellContent)
    ) {
      issues.push({
        code: "shell-missing-sentry-map",
        message: `sync-secrets.sh must call map_sentry_storage_to_runtime ${service} before syncing ${service}`,
      });
    }
  }

  validatePreflightKeys(options.shellContent, issues);

  for (const { service, secrets } of SYNC_SECRETS_MANIFEST) {
    const shellArrays = SERVICE_SHELL_ARRAYS[service];
    const shellKeys = new Set<string>();
    for (const arrayName of shellArrays) {
      for (const key of parseSyncSecretsShellArrayKeys(
        options.shellContent,
        arrayName,
      )) {
        shellKeys.add(key);
      }
    }

    const runtimeKeys = new Set(secrets.map((entry) => entry.runtimeKey));
    for (const runtimeKey of runtimeKeys) {
      if (!shellKeys.has(runtimeKey)) {
        issues.push({
          code: "shell-missing-runtime-key",
          message: `sync-secrets.sh missing runtime key ${runtimeKey} for ${service}`,
        });
      }
    }

    for (const shellKey of shellKeys) {
      if (!runtimeKeys.has(shellKey)) {
        issues.push({
          code: "shell-extra-runtime-key",
          message: `sync-secrets.sh lists undeclared runtime key ${shellKey} for ${service}`,
        });
      }
    }

    const { base, cloud } = strictFieldsForService(service);
    const manifestRuntime = manifestRuntimeKeys(service);
    const manifestRequired = manifestRequiredRuntimeKeys(service);

    for (const strictKey of [...base, ...cloud]) {
      if (!manifestRuntime.has(strictKey)) {
        issues.push({
          code: "manifest-missing-strict-field",
          message: `manifest for ${service} missing env.ts strict field ${strictKey}`,
        });
      }
      if (!manifestRequired.has(strictKey)) {
        issues.push({
          code: "manifest-strict-not-required",
          message: `manifest must mark env.ts strict field ${strictKey} as required for ${service}`,
        });
      }
    }

    for (const entry of secrets) {
      if (!entry.required) {
        continue;
      }
      const inStrict =
        (base as readonly string[]).includes(entry.runtimeKey) ||
        (cloud as readonly string[]).includes(entry.runtimeKey);
      if (!inStrict) {
        issues.push({
          code: "manifest-required-not-strict",
          message: `manifest marks ${entry.runtimeKey} required for ${service} but it is not in env.ts strict fields`,
        });
      }
    }
  }

  return issues;
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `- [${issue.code}] ${issue.message}`).join("\n");
}

function main(): void {
  const issues = validateSyncSecretsManifest({
    yamlContent: readRepoFile(".github/workflows/sync-secrets.yml"),
    shellContent: readRepoFile(".github/scripts/sync-secrets.sh"),
    githubMapContent: readRepoFile(".github/scripts/github-secret-map.sh"),
  });

  if (issues.length > 0) {
    console.error("validate-sync-secrets-manifest: FAIL\n");
    console.error(formatValidationIssues(issues));
    process.exit(1);
  }

  console.log("validate-sync-secrets-manifest: PASS");
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}

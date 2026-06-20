import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GITHUB_STORAGE_TO_RUNTIME,
  SYNC_SECRETS_MANIFEST,
  requiredGhaStorageKeys,
  resolveGhaStorageKey,
} from "./sync-secrets-manifest.js";
import {
  formatValidationIssues,
  parseGithubSecretMapPairs,
  parseSyncSecretsShellArrayKeys,
  parseSyncSecretsYamlKeys,
  validateSyncSecretsManifest,
} from "../../scripts/validate-sync-secrets-manifest.ts";

const REPO_ROOT = join(import.meta.dirname, "../..");

const BASE_YAML = `
          FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}
          CF_API_TOKEN: \${{ secrets.CF_API_TOKEN }}
          CF_ACCOUNT_ID: \${{ secrets.CF_ACCOUNT_ID }}
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          GH_APP_ID: \${{ secrets.GH_APP_ID }}
`;

const BASE_SHELL = `
API_FLY_KEYS=(
  DATABASE_URL
  REDIS_URL
  GITHUB_APP_ID
)
WORKER_FLY_KEYS=(
  DATABASE_URL
  REDIS_URL
  GITHUB_APP_ID
)
WEB_WRANGLER_KEYS=(
  NEXT_PUBLIC_API_URL
)
MARKETING_WRANGLER_KEYS=(
  UMAMI_SCRIPT_URL
)
`;

const BASE_GITHUB_MAP = `
  local -a pairs=(
    GH_APP_ID:GITHUB_APP_ID
    GH_APP_PRIVATE_KEY:GITHUB_APP_PRIVATE_KEY
    GH_WEBHOOK_SECRET:GITHUB_WEBHOOK_SECRET
    GH_CLIENT_ID:GITHUB_CLIENT_ID
    GH_CLIENT_SECRET:GITHUB_CLIENT_SECRET
    GH_APP_SLUG:GITHUB_APP_SLUG
  )
`;

function readFixture(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("sync-secrets-manifest", () => {
  it("maps GH_* storage keys to GITHUB_* runtime keys", () => {
    expect(GITHUB_STORAGE_TO_RUNTIME.GH_APP_ID).toBe("GITHUB_APP_ID");
    expect(Object.keys(GITHUB_STORAGE_TO_RUNTIME)).toHaveLength(6);
  });

  it("marks REDIS_URL as derived for api, worker, and admin", () => {
    for (const service of ["api", "worker", "admin"] as const) {
      const entry = SYNC_SECRETS_MANIFEST.find((m) => m.service === service)
        ?.secrets.find((s) => s.runtimeKey === "REDIS_URL");
      expect(entry?.source).toBe("derived");
      expect(entry?.required).toBe(true);
    }
  });

  it("uses GH_* as GHA storage keys for GitHub App credentials", () => {
    const apiGithub = SYNC_SECRETS_MANIFEST.find((m) => m.service === "api")
      ?.secrets.filter((s) => s.runtimeKey.startsWith("GITHUB_"));
    expect(apiGithub?.every((s) => s.ghaStorageKey?.startsWith("GH_"))).toBe(
      true,
    );
  });

  it("lists required GHA keys excluding derived REDIS_URL", () => {
    const keys = requiredGhaStorageKeys("api", "ce");
    expect(keys).toContain("DATABASE_URL");
    expect(keys).toContain("GH_APP_ID");
    expect(keys).not.toContain("REDIS_URL");
  });
});

describe("validateSyncSecretsManifest", () => {
  it("passes on the current repository fixtures", () => {
    const issues = validateSyncSecretsManifest({
      yamlContent: readFixture(".github/workflows/sync-secrets.yml"),
      shellContent: readFixture(".github/scripts/sync-secrets.sh"),
      githubMapContent: readFixture(".github/scripts/github-secret-map.sh"),
    });
    expect(issues).toEqual([]);
  });

  it("fails when a manifest GHA key is missing from sync-secrets.yml", () => {
    const issues = validateSyncSecretsManifest({
      yamlContent: BASE_YAML,
      shellContent: readFixture(".github/scripts/sync-secrets.sh"),
      githubMapContent: readFixture(".github/scripts/github-secret-map.sh"),
    });
    expect(issues.some((i) => i.code === "yaml-missing-gha-key")).toBe(true);
    expect(formatValidationIssues(issues)).toMatch(/missing GHA secret mapping/);
  });

  it("fails when REDIS_URL appears in sync-secrets.yml", () => {
    const yaml = `${BASE_YAML}\n          REDIS_URL: \${{ secrets.REDIS_URL }}`;
    const issues = validateSyncSecretsManifest({
      yamlContent: yaml,
      shellContent: readFixture(".github/scripts/sync-secrets.sh"),
      githubMapContent: readFixture(".github/scripts/github-secret-map.sh"),
    });
    expect(issues.some((i) => i.code === "yaml-derived-forbidden")).toBe(true);
  });

  it("fails when sync-secrets.sh runtime arrays drift from manifest", () => {
    const issues = validateSyncSecretsManifest({
      yamlContent: readFixture(".github/workflows/sync-secrets.yml"),
      shellContent: BASE_SHELL,
      githubMapContent: readFixture(".github/scripts/github-secret-map.sh"),
    });
    expect(issues.some((i) => i.code.startsWith("shell-"))).toBe(true);
  });

  it("parses yaml, shell, and github map helpers", () => {
    expect(parseSyncSecretsYamlKeys(BASE_YAML)).toEqual(
      new Set([
        "FLY_API_TOKEN",
        "CF_API_TOKEN",
        "CF_ACCOUNT_ID",
        "DATABASE_URL",
        "GH_APP_ID",
      ]),
    );
    expect(parseSyncSecretsShellArrayKeys(BASE_SHELL, "API_FLY_KEYS")).toEqual(
      new Set(["DATABASE_URL", "REDIS_URL", "GITHUB_APP_ID"]),
    );
    expect(parseGithubSecretMapPairs(BASE_GITHUB_MAP).get("GH_APP_ID")).toBe(
      "GITHUB_APP_ID",
    );
  });
});

describe("resolveGhaStorageKey", () => {
  it("returns ghaStorageKey when set", () => {
    expect(
      resolveGhaStorageKey({
        runtimeKey: "GITHUB_APP_ID",
        source: "gha",
        ghaStorageKey: "GH_APP_ID",
        required: true,
      }),
    ).toBe("GH_APP_ID");
  });
});

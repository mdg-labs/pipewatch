#!/usr/bin/env node
/**
 * Validate locale JSON catalogs under apps/web — key parity across locales,
 * non-empty leaf string values, and alignment with supported-locales.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = join(__dirname, "..");
export const DEFAULT_LOCALES_DIR = join(
  DEFAULT_REPO_ROOT,
  "apps/web/src/i18n/locales",
);
export const DEFAULT_SUPPORTED_LOCALES_PATH = join(
  DEFAULT_REPO_ROOT,
  "apps/web/src/i18n/supported-locales.json",
);

export type SupportedLocalesConfig = {
  defaultLocale: string;
  fallbackLocale: string;
  locales: string[];
};

export type I18nValidateIssue = {
  code: string;
  message: string;
};

export function flattenMessageKeys(
  value: Record<string, unknown>,
  prefix = "",
): Set<string> {
  const keys = new Set<string>();

  for (const [key, nested] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      nested !== null &&
      typeof nested === "object" &&
      !Array.isArray(nested)
    ) {
      for (const childKey of flattenMessageKeys(
        nested as Record<string, unknown>,
        fullKey,
      )) {
        keys.add(childKey);
      }
      continue;
    }

    keys.add(fullKey);
  }

  return keys;
}

export function leafStringValues(
  value: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const values = new Map<string, string>();

  for (const [key, nested] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      nested !== null &&
      typeof nested === "object" &&
      !Array.isArray(nested)
    ) {
      for (const [childKey, childValue] of leafStringValues(
        nested as Record<string, unknown>,
        fullKey,
      )) {
        values.set(childKey, childValue);
      }
      continue;
    }

    if (typeof nested === "string") {
      values.set(fullKey, nested);
    }
  }

  return values;
}

export function parseSupportedLocales(
  content: string,
): SupportedLocalesConfig {
  const parsed = JSON.parse(content) as Partial<SupportedLocalesConfig>;
  if (
    typeof parsed.defaultLocale !== "string" ||
    typeof parsed.fallbackLocale !== "string" ||
    !Array.isArray(parsed.locales) ||
    parsed.locales.some((locale) => typeof locale !== "string")
  ) {
    throw new Error("supported-locales.json has invalid shape");
  }

  return {
    defaultLocale: parsed.defaultLocale,
    fallbackLocale: parsed.fallbackLocale,
    locales: parsed.locales,
  };
}

export function compareLocaleKeySets(
  canonicalKeys: Set<string>,
  locale: string,
  localeKeys: Set<string>,
): I18nValidateIssue[] {
  const issues: I18nValidateIssue[] = [];

  for (const key of canonicalKeys) {
    if (!localeKeys.has(key)) {
      issues.push({
        code: "missing-key",
        message: `locale "${locale}" missing key "${key}"`,
      });
    }
  }

  for (const key of localeKeys) {
    if (!canonicalKeys.has(key)) {
      issues.push({
        code: "extra-key",
        message: `locale "${locale}" has extra key "${key}"`,
      });
    }
  }

  return issues;
}

export function validateI18nCatalog(options?: {
  repoRoot?: string;
  localesDir?: string;
  supportedLocalesPath?: string;
  readFile?: (path: string) => string;
  existsFile?: (path: string) => boolean;
}): I18nValidateIssue[] {
  const repoRoot = options?.repoRoot ?? DEFAULT_REPO_ROOT;
  const localesDir =
    options?.localesDir ?? join(repoRoot, "apps/web/src/i18n/locales");
  const supportedLocalesPath =
    options?.supportedLocalesPath ??
    join(repoRoot, "apps/web/src/i18n/supported-locales.json");
  const readFile = options?.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const existsFile = options?.existsFile ?? ((path: string) => existsSync(path));

  const issues: I18nValidateIssue[] = [];

  if (!existsFile(supportedLocalesPath)) {
    issues.push({
      code: "missing-supported-locales",
      message: `missing supported locales file: ${supportedLocalesPath}`,
    });
    return issues;
  }

  let supported: SupportedLocalesConfig;
  try {
    supported = parseSupportedLocales(readFile(supportedLocalesPath));
  } catch (error) {
    issues.push({
      code: "invalid-supported-locales",
      message:
        error instanceof Error
          ? error.message
          : "supported-locales.json is invalid",
    });
    return issues;
  }

  if (supported.locales.length === 0) {
    issues.push({
      code: "no-locales",
      message: "supported-locales.json must list at least one locale",
    });
    return issues;
  }

  if (!supported.locales.includes(supported.defaultLocale)) {
    issues.push({
      code: "default-locale-missing",
      message: `defaultLocale "${supported.defaultLocale}" is not listed in locales`,
    });
  }

  const localeMessages = new Map<string, Record<string, unknown>>();

  for (const locale of supported.locales) {
    const localePath = join(localesDir, `${locale}.json`);
    if (!existsFile(localePath)) {
      issues.push({
        code: "missing-locale-file",
        message: `missing locale file: ${localePath}`,
      });
      continue;
    }

    try {
      localeMessages.set(
        locale,
        JSON.parse(readFile(localePath)) as Record<string, unknown>,
      );
    } catch {
      issues.push({
        code: "invalid-locale-json",
        message: `invalid JSON in locale file: ${localePath}`,
      });
    }
  }

  if (localeMessages.size === 0) {
    return issues;
  }

  const canonicalLocale = supported.defaultLocale;
  const canonicalMessages = localeMessages.get(canonicalLocale);
  if (!canonicalMessages) {
    issues.push({
      code: "missing-canonical-locale",
      message: `canonical locale "${canonicalLocale}" could not be loaded`,
    });
    return issues;
  }

  const canonicalKeys = flattenMessageKeys(canonicalMessages);

  for (const [locale, messages] of localeMessages) {
    if (locale === canonicalLocale) {
      continue;
    }

    issues.push(
      ...compareLocaleKeySets(
        canonicalKeys,
        locale,
        flattenMessageKeys(messages),
      ),
    );
  }

  for (const [locale, messages] of localeMessages) {
    for (const [key, value] of leafStringValues(messages)) {
      if (value.trim().length === 0) {
        issues.push({
          code: "empty-value",
          message: `locale "${locale}" has empty value for key "${key}"`,
        });
      }
    }
  }

  return issues;
}

export function formatI18nValidateIssues(issues: I18nValidateIssue[]): string {
  return issues.map((issue) => `- [${issue.code}] ${issue.message}`).join("\n");
}

function main(): void {
  const issues = validateI18nCatalog();

  if (issues.length > 0) {
    console.error("i18n-validate: FAIL\n");
    console.error(formatI18nValidateIssues(issues));
    process.exit(1);
  }

  console.log("i18n-validate: PASS");
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}

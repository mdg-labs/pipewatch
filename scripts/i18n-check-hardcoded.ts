#!/usr/bin/env node
/**
 * Fail on user-facing English string literals in UI .tsx sources.
 *
 * Scans packages/ui and apps/web. Grandfathered files with intentional English
 * defaults are allowlisted until follow-up migration tasks remove them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = join(__dirname, "..");

/** Active scan roots. */
export const I18N_HARDCODED_SCAN_ROOTS = [
  "packages/ui/src",
  "apps/web/src",
] as const;

/**
 * packages/ui files still shipping English fallbacks until prop/i18n cleanup.
 * Remove entries as each file is migrated.
 */
export const I18N_HARDCODED_UI_ALLOWLISTED_FILES = [
  "packages/ui/src/components/avatar.tsx",
  "packages/ui/src/components/bar-chart.tsx",
  "packages/ui/src/components/data-table.tsx",
  "packages/ui/src/components/logo-wordmark.tsx",
  "packages/ui/src/components/run-pulse.tsx",
  "packages/ui/src/components/status-badge.tsx",
  "packages/ui/src/components/time-series-chart.tsx",
] as const;

/**
 * apps/web files not yet migrated to next-intl. Remove entries as each lands.
 * App shell + shared primitives migrated in #201.
 */
export const I18N_HARDCODED_WEB_ALLOWLISTED_FILES = [
  "apps/web/src/components/account/AccountSettings.tsx",
  "apps/web/src/components/auth/BootstrapCard.tsx",
  "apps/web/src/components/auth/SignInCard.tsx",
  "apps/web/src/components/billing/BillingPlanCard.tsx",
  "apps/web/src/components/billing/UsageMeter.tsx",
  "apps/web/src/components/dashboard/DashboardControls.tsx",
  "apps/web/src/components/dashboard/DashboardRepoCard.tsx",
  "apps/web/src/components/dashboard/DashboardRepoTable.tsx",
  "apps/web/src/components/dashboard/DashboardView.tsx",
  "apps/web/src/components/dashboard/HealthBar.tsx",
  "apps/web/src/components/insights/InsightsCharts.tsx",
  "apps/web/src/components/insights/InsightsPageClient.tsx",
  "apps/web/src/components/insights/InsightsTables.tsx",
  "apps/web/src/components/insights/InsightsView.tsx",
  "apps/web/src/components/invites/InviteAcceptCard.tsx",
  "apps/web/src/components/onboarding/OnboardingWizard.tsx",
  "apps/web/src/components/onboarding/steps/CreateWorkspaceStep.tsx",
  "apps/web/src/components/onboarding/steps/DoneStep.tsx",
  "apps/web/src/components/onboarding/steps/InstallGitHubStep.tsx",
  "apps/web/src/components/onboarding/steps/SelectReposStep.tsx",
  "apps/web/src/components/repos/ActiveRunBanner.tsx",
  "apps/web/src/components/repos/RepoDetailPageClient.tsx",
  "apps/web/src/components/repos/RepoDetailView.tsx",
  "apps/web/src/components/repos/RepoHeader.tsx",
  "apps/web/src/components/repos/RepoSettingsForm.tsx",
  "apps/web/src/components/repos/WorkflowTabs.tsx",
  "apps/web/src/components/runs/ElapsedTicker.tsx",
  "apps/web/src/components/runs/JobGraph.tsx",
  "apps/web/src/components/runs/JobPanel.tsx",
  "apps/web/src/components/runs/RunDetailView.tsx",
  "apps/web/src/components/runs/RunFilters.tsx",
  "apps/web/src/components/runs/RunListTable.tsx",
  "apps/web/src/components/runs/StepRow.tsx",
  "apps/web/src/components/settings/ApiKeysTable.tsx",
  "apps/web/src/components/settings/CreateApiKeyModal.tsx",
  "apps/web/src/components/settings/IntegrationCard.tsx",
  "apps/web/src/components/settings/IntegrationsSettingsView.tsx",
  "apps/web/src/components/settings/InviteMemberModal.tsx",
  "apps/web/src/components/settings/MembersTable.tsx",
  "apps/web/src/components/settings/WorkspaceGeneralForm.tsx",
  "apps/web/src/contexts/live-stream-override-context.tsx",
] as const;

export const I18N_HARDCODED_ALLOWLISTED_FILES = [
  ...I18N_HARDCODED_UI_ALLOWLISTED_FILES,
  ...I18N_HARDCODED_WEB_ALLOWLISTED_FILES,
] as const;

const TEST_FILE_PATTERN = /\.(test|spec)\.tsx$/;

const TECHNICAL_LITERAL =
  /^(?:pw-[\w-]+|var\(--[\w-]+\)|[a-z]+(?:-[a-z]+)*|[A-Z][A-Z0-9_]*|sm|md|lg|xl|2xl|off|hidden|button|submit|status|group|img|dialog|polite|checkbox|radio|switch|tab|tabpanel|listbox|option|menuitem|none|true|false|\d+(?:\.\d+)?(?:px|rem|em|%)?)$/;

const KEYBOARD_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "End",
  "Enter",
  "Escape",
  "Home",
  "Space",
  "Tab",
  " ",
]);

const USER_FACING_ATTRS = new Set([
  "alt",
  "aria-label",
  "label",
  "placeholder",
  "title",
]);

export type HardcodedStringFinding = {
  file: string;
  line: number;
  column: number;
  text: string;
  kind: "literal" | "jsx-text";
};

export type I18nHardcodedIssue = {
  code: string;
  message: string;
  finding: HardcodedStringFinding;
};

function isTestTsxFile(relativePath: string): boolean {
  return TEST_FILE_PATTERN.test(relativePath);
}

function walkTsxFiles(rootDir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(rootDir)) {
    const absolutePath = join(rootDir, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walkTsxFiles(absolutePath, files);
      continue;
    }

    if (entry.endsWith(".tsx")) {
      files.push(absolutePath);
    }
  }

  return files;
}

export function isAllowlistedHardcodedFile(
  relativePath: string,
  allowlist: readonly string[] = I18N_HARDCODED_ALLOWLISTED_FILES,
): boolean {
  return allowlist.includes(relativePath);
}

export function looksLikeUserFacingEnglish(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) {
    return false;
  }

  if (KEYBOARD_KEYS.has(trimmed)) {
    return false;
  }

  if (TECHNICAL_LITERAL.test(trimmed)) {
    return false;
  }

  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed)) {
    return false;
  }

  if (/^https?:\/\//.test(trimmed) || /^\/[\w/-]*$/.test(trimmed)) {
    return false;
  }

  if (/^[^A-Za-z]*$/.test(trimmed)) {
    return false;
  }

  if (trimmed.includes("${")) {
    return false;
  }

  if (/^[A-Z][a-z]+(?:\s+[A-Za-z][\w'-]*)+$/.test(trimmed)) {
    return true;
  }

  if (/^[A-Z][a-z]{2,}['\u2019]s\b/.test(trimmed)) {
    return true;
  }

  return /^[A-Z][a-z]{2,}(?:[.!?]|$)/.test(trimmed);
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length))
    .replace(/(^|[^:])\/\/.*$/gm, (match) =>
      match.startsWith("://") ? match : " ".repeat(match.length),
    );
}

function lineColumnAtIndex(source: string, index: number): { line: number; column: number } {
  const before = source.slice(0, index);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function isImportLine(line: string): boolean {
  return /^\s*import\s/.test(line);
}

function isTypeLevelLiteralLine(line: string): boolean {
  return /Omit<|Pick<|extends\s|keyof\s|Record<|Partial</.test(line);
}

function isComparisonLine(line: string): boolean {
  return /\w\s+[<>]=?\s+[\w\d(]/.test(line);
}

function isTechnicalAttributeContext(line: string, quoteIndex: number): boolean {
  const before = line.slice(0, quoteIndex);
  return /(?:className|role|type|variant|size|tone|id|htmlFor|autoComplete|spellCheck|inputMode|name|value|key)\s*=\s*["'`]?[^"'`]*$/i.test(
    before,
  );
}

function isUserFacingAttributeContext(line: string, quoteIndex: number): boolean {
  const before = line.slice(0, quoteIndex);
  for (const attr of USER_FACING_ATTRS) {
    const pattern = new RegExp(`${attr}\\s*=\\s*["'\`]*[^"'\`]*$`);
    if (pattern.test(before)) {
      return true;
    }
  }
  return false;
}

function shouldIgnoreLiteral(line: string, quoteIndex: number, value: string): boolean {
  if (isImportLine(line)) {
    return true;
  }

  if (isTypeLevelLiteralLine(line)) {
    return true;
  }

  if (isComparisonLine(line)) {
    return true;
  }

  if (isTechnicalAttributeContext(line, quoteIndex)) {
    return true;
  }

  if (/event\.key\s*===\s*["']/.test(line) || /\.includes\(event\.key\)/.test(line)) {
    return true;
  }

  if (/\.match\(|RegExp\(|new RegExp\(/.test(line)) {
    return true;
  }

  if (/`/.test(line)) {
    return true;
  }

  if (!isUserFacingAttributeContext(line, quoteIndex) && /^\s*\/\*\*/.test(line)) {
    return true;
  }

  return !looksLikeUserFacingEnglish(value);
}

export function findHardcodedStringLiterals(
  source: string,
  relativePath: string,
): HardcodedStringFinding[] {
  const findings: HardcodedStringFinding[] = [];
  const sanitized = stripComments(source);
  const literalPattern = /(["'`])((?:\\.|(?!\1).)*)\1/g;

  for (const match of sanitized.matchAll(literalPattern)) {
    const value = match[2] ?? "";
    const index = match.index ?? 0;
    const { line, column } = lineColumnAtIndex(source, index);
    const currentLine = source.split("\n")[line - 1] ?? "";

    if (shouldIgnoreLiteral(currentLine, column - 1, value)) {
      continue;
    }

    findings.push({
      file: relativePath,
      line,
      column,
      text: value,
      kind: "literal",
    });
  }

  const jsxTextPattern = />\s*([A-Z][^<>{}\n;=()]*[A-Za-z][^<>{}\n;=()]*)\s*</g;
  for (const match of sanitized.matchAll(jsxTextPattern)) {
    const value = match[1]?.trim() ?? "";
    if (!looksLikeUserFacingEnglish(value)) {
      continue;
    }

    const index = match.index ?? 0;
    const { line, column } = lineColumnAtIndex(source, index + 1);
    findings.push({
      file: relativePath,
      line,
      column,
      text: value,
      kind: "jsx-text",
    });
  }

  return findings;
}

export function checkHardcodedStringsInFile(options: {
  repoRoot: string;
  relativePath: string;
  allowlist?: readonly string[];
  readFile?: (path: string) => string;
}): I18nHardcodedIssue[] {
  const allowlist = options.allowlist ?? I18N_HARDCODED_ALLOWLISTED_FILES;
  if (isAllowlistedHardcodedFile(options.relativePath, allowlist)) {
    return [];
  }

  if (isTestTsxFile(options.relativePath)) {
    return [];
  }

  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const absolutePath = join(options.repoRoot, options.relativePath);
  const source = readFile(absolutePath);

  return findHardcodedStringLiterals(source, options.relativePath).map(
    (finding) => ({
      code: "hardcoded-english",
      message: `${finding.file}:${finding.line}:${finding.column} hardcoded English (${finding.kind}): "${finding.text}"`,
      finding,
    }),
  );
}

export function checkHardcodedStrings(options?: {
  repoRoot?: string;
  scanRoots?: readonly string[];
  allowlist?: readonly string[];
  readFile?: (path: string) => string;
}): I18nHardcodedIssue[] {
  const repoRoot = options?.repoRoot ?? DEFAULT_REPO_ROOT;
  const scanRoots = options?.scanRoots ?? I18N_HARDCODED_SCAN_ROOTS;
  const issues: I18nHardcodedIssue[] = [];

  for (const scanRoot of scanRoots) {
    const absoluteRoot = join(repoRoot, scanRoot);
    for (const absolutePath of walkTsxFiles(absoluteRoot)) {
      const relativePath = relative(repoRoot, absolutePath).replaceAll("\\", "/");
      issues.push(
        ...checkHardcodedStringsInFile({
          repoRoot,
          relativePath,
          ...(options?.allowlist ? { allowlist: options.allowlist } : {}),
          ...(options?.readFile ? { readFile: options.readFile } : {}),
        }),
      );
    }
  }

  return issues;
}

export function formatI18nHardcodedIssues(issues: I18nHardcodedIssue[]): string {
  return issues.map((issue) => `- [${issue.code}] ${issue.message}`).join("\n");
}

function main(): void {
  const issues = checkHardcodedStrings();

  if (issues.length > 0) {
    console.error("i18n-check-hardcoded: FAIL\n");
    console.error(`Scan roots: ${I18N_HARDCODED_SCAN_ROOTS.join(", ")}\n`);
    console.error(formatI18nHardcodedIssues(issues));
    process.exit(1);
  }

  console.log(
    `i18n-check-hardcoded: PASS (${I18N_HARDCODED_SCAN_ROOTS.join(", ")})`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}

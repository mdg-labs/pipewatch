import { getPlanLimits, type WorkspacePlan } from "@pipewatch/config/plan-limits";
import type { RepositorySummary, UpdateRepositoryInput } from "@pipewatch/types";

export const MIN_POLLING_INTERVAL_SECONDS = 30;
export const DEFAULT_POLLING_INTERVAL_SECONDS = 60;

export type SyncMode = "webhook" | "polling";

export type RepoSettingsFormValues = {
  syncMode: SyncMode;
  pollingInterval: string;
  usePlanDefault: boolean;
  customRetentionDays: string;
};

/** Derive sync mode from stored polling interval — null means webhook (PRD §5). */
export function getSyncMode(pollingIntervalSeconds: number | null): SyncMode {
  return pollingIntervalSeconds === null ? "webhook" : "polling";
}

export function repositoryToFormValues(
  repository: RepositorySummary,
  defaultRetentionDays: number,
): RepoSettingsFormValues {
  const syncMode = getSyncMode(repository.polling_interval_seconds);
  const usePlanDefault = repository.retention_days === null;

  return {
    syncMode,
    pollingInterval: String(
      repository.polling_interval_seconds ?? DEFAULT_POLLING_INTERVAL_SECONDS,
    ),
    usePlanDefault,
    customRetentionDays: String(
      repository.retention_days ?? defaultRetentionDays,
    ),
  };
}

export function parsePollingIntervalInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

/** Client-side polling interval validation — mirrors API min 30s (PRD §5, B5). */
export function isValidPollingInterval(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= MIN_POLLING_INTERVAL_SECONDS;
}

export function clampRetentionDaysForPlan(
  days: number,
  plan: WorkspacePlan,
  applyCeiling: boolean,
): number {
  if (!applyCeiling) {
    return days;
  }

  const { minRetentionDays, maxRetentionDays } = getPlanLimits(plan);
  return Math.min(Math.max(days, minRetentionDays), maxRetentionDays);
}

/** Client-side retention validation before PATCH. */
export function isValidRetentionDays(
  days: number,
  plan: WorkspacePlan,
  applyCeiling: boolean,
): boolean {
  if (!Number.isInteger(days) || days < 1) {
    return false;
  }

  if (!applyCeiling) {
    return true;
  }

  const { minRetentionDays, maxRetentionDays } = getPlanLimits(plan);
  return days >= minRetentionDays && days <= maxRetentionDays;
}

export function getEffectiveRetentionDays(
  retentionDays: number | null,
  defaultRetentionDays: number,
): number {
  return retentionDays ?? defaultRetentionDays;
}

export function retentionRangeHint(
  plan: WorkspacePlan,
  applyCeiling: boolean,
): string | null {
  if (!applyCeiling) {
    return null;
  }

  const { minRetentionDays, maxRetentionDays } = getPlanLimits(plan);
  return `Minimum ${String(minRetentionDays)} days · Maximum ${String(maxRetentionDays)} days on your plan`;
}

export function planDefaultRetentionLabel(defaultRetentionDays: number): string {
  return `Use plan default (${String(defaultRetentionDays)} days)`;
}

function resolvePollingIntervalForPatch(
  values: RepoSettingsFormValues,
): number | null {
  if (values.syncMode === "webhook") {
    return null;
  }

  const parsed = parsePollingIntervalInput(values.pollingInterval);
  if (parsed === null || !isValidPollingInterval(parsed)) {
    return undefined as never;
  }

  return parsed;
}

function resolveRetentionDaysForPatch(
  values: RepoSettingsFormValues,
  plan: WorkspacePlan,
  applyCeiling: boolean,
): number | null {
  if (values.usePlanDefault) {
    return null;
  }

  const parsed = parsePollingIntervalInput(values.customRetentionDays);
  if (parsed === null || !isValidRetentionDays(parsed, plan, applyCeiling)) {
    return undefined as never;
  }

  return clampRetentionDaysForPlan(parsed, plan, applyCeiling);
}

/** Build PATCH body for sync mode, interval, and retention — undefined when unchanged. */
export function buildRepositorySettingsPatch(
  values: RepoSettingsFormValues,
  repository: RepositorySummary,
  options: {
    plan: WorkspacePlan;
    applyRetentionCeiling: boolean;
  },
): UpdateRepositoryInput | null {
  const body: UpdateRepositoryInput = {};

  const nextPollingInterval = resolvePollingIntervalForPatch(values);
  if (nextPollingInterval !== repository.polling_interval_seconds) {
    body.polling_interval_seconds = nextPollingInterval;
  }

  const nextRetentionDays = resolveRetentionDaysForPatch(
    values,
    options.plan,
    options.applyRetentionCeiling,
  );
  if (nextRetentionDays !== repository.retention_days) {
    body.retention_days = nextRetentionDays;
  }

  return Object.keys(body).length > 0 ? body : null;
}

export function isRepoSettingsFormValid(
  values: RepoSettingsFormValues,
  plan: WorkspacePlan,
  applyRetentionCeiling: boolean,
): boolean {
  if (values.syncMode === "polling") {
    const polling = parsePollingIntervalInput(values.pollingInterval);
    if (polling === null || !isValidPollingInterval(polling)) {
      return false;
    }
  }

  if (!values.usePlanDefault) {
    const retention = parsePollingIntervalInput(values.customRetentionDays);
    if (retention === null || !isValidRetentionDays(retention, plan, applyRetentionCeiling)) {
      return false;
    }
  }

  return true;
}

export function repoSettingsHasChanges(
  values: RepoSettingsFormValues,
  repository: RepositorySummary,
  options: {
    plan: WorkspacePlan;
    applyRetentionCeiling: boolean;
  },
): boolean {
  return buildRepositorySettingsPatch(values, repository, options) !== null;
}

import { describe, expect, it } from "vitest";

import type { RepositorySummary } from "@pipewatch/types";

import {
  buildRepositorySettingsPatch,
  clampRetentionDaysForPlan,
  DEFAULT_POLLING_INTERVAL_SECONDS,
  EN_REPO_SETTINGS_LABELS,
  getEffectiveRetentionDays,
  getSyncMode,
  isRepoSettingsFormValid,
  isValidPollingInterval,
  isValidRetentionDays,
  MIN_POLLING_INTERVAL_SECONDS,
  parsePollingIntervalInput,
  planDefaultRetentionLabel,
  repositoryToFormValues,
  retentionRangeHint,
} from "./repo-settings";

const repository: RepositorySummary = {
  id: "33333333-3333-4333-8333-333333333331",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  integration_id: "11111111-1111-4111-8111-111111111111",
  external_repo_id: "1",
  full_name: "mdg-labs/pipewatch",
  private: false,
  enabled: true,
  polling_interval_seconds: null,
  retention_days: null,
  last_synced_at: "2026-06-17T12:00:00.000Z",
};

describe("repo-settings validation", () => {
  it("derives webhook mode when polling interval is null", () => {
    expect(getSyncMode(null)).toBe("webhook");
    expect(getSyncMode(60)).toBe("polling");
  });

  it("maps repository state to form defaults", () => {
    expect(repositoryToFormValues(repository, 30)).toEqual({
      syncMode: "webhook",
      pollingInterval: String(DEFAULT_POLLING_INTERVAL_SECONDS),
      usePlanDefault: true,
      customRetentionDays: "30",
    });
  });

  it("validates polling interval minimum", () => {
    expect(isValidPollingInterval(MIN_POLLING_INTERVAL_SECONDS)).toBe(true);
    expect(isValidPollingInterval(MIN_POLLING_INTERVAL_SECONDS - 1)).toBe(false);
    expect(parsePollingIntervalInput("60.9")).toBe(60);
    expect(parsePollingIntervalInput("")).toBeNull();
    expect(parsePollingIntervalInput("abc")).toBeNull();
  });

  it("clamps retention to plan range on cloud", () => {
    expect(clampRetentionDaysForPlan(400, "pro", true)).toBe(365);
    expect(clampRetentionDaysForPlan(10, "pro", true)).toBe(30);
    expect(clampRetentionDaysForPlan(400, "pro", false)).toBe(400);
  });

  it("validates retention against plan limits on cloud", () => {
    expect(isValidRetentionDays(30, "free", true)).toBe(true);
    expect(isValidRetentionDays(90, "free", true)).toBe(false);
    expect(isValidRetentionDays(90, "free", false)).toBe(true);
  });

  it("builds PATCH payload for sync and retention changes", () => {
    const patch = buildRepositorySettingsPatch(
      {
        syncMode: "polling",
        pollingInterval: "45",
        usePlanDefault: false,
        customRetentionDays: "120",
      },
      repository,
      { plan: "pro", applyRetentionCeiling: true },
    );

    expect(patch).toEqual({
      polling_interval_seconds: 45,
      retention_days: 120,
    });
  });

  it("returns null patch when settings are unchanged", () => {
    const values = repositoryToFormValues(repository, 30);
    expect(
      buildRepositorySettingsPatch(values, repository, {
        plan: "free",
        applyRetentionCeiling: true,
      }),
    ).toBeNull();
  });

  it("rejects invalid form state", () => {
    expect(
      isRepoSettingsFormValid(
        {
          syncMode: "polling",
          pollingInterval: "15",
          usePlanDefault: true,
          customRetentionDays: "30",
        },
        "free",
        true,
      ),
    ).toBe(false);
  });

  it("formats retention helper copy", () => {
    expect(getEffectiveRetentionDays(null, 30)).toBe(30);
    expect(planDefaultRetentionLabel(30, EN_REPO_SETTINGS_LABELS)).toBe(
      "Use plan default (30 days)",
    );
    expect(retentionRangeHint("pro", true, EN_REPO_SETTINGS_LABELS)).toContain("365");
    expect(retentionRangeHint("pro", false, EN_REPO_SETTINGS_LABELS)).toBeNull();
  });
});

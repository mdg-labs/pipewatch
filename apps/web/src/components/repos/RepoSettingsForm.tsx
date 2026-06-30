"use client";

import { flags } from "@pipewatch/config/edition";
import type { RepositorySummary, Workspace } from "@pipewatch/types";
import { Clock3, Github } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  DangerZone,
  DangerZoneItem,
  Input,
  RadioGroup,
  Switch,
  TypedConfirmDialog,
} from "@pipewatch/ui";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import { githubRepoUrl, parseRepoFullName } from "@/lib/dashboard-utils";
import {
  buildRepositorySettingsPatch,
  getEffectiveRetentionDays,
  isRepoSettingsFormValid,
  planDefaultRetentionLabel,
  repoSettingsHasChanges,
  repositoryToFormValues,
  retentionRangeHint,
  type RepoSettingsLabels,
  type RepoSettingsFormValues,
  type SyncMode,
} from "@/lib/repo-settings";
import { useToast } from "@/providers/ToastProvider";

import "./repo-settings.css";

export type RepoSettingsFormProps = {
  repoId: string;
};

/** Repository settings form — sync mode, retention, disable/delete (B5). */
export function RepoSettingsForm({ repoId }: RepoSettingsFormProps) {
  const router = useRouter();
  const { workspace, workspaceSlug, workspaceStatus } = useApi();
  const { canMutate } = useWorkspaceRole();
  const { toast } = useToast();
  const t = useTranslations("repos.settings");
  const tUi = useTranslations("ui");

  const repoSettingsLabels = useMemo<RepoSettingsLabels>(
    () => ({
      planDefault: (days) => t("retention.planDefault", { days }),
      rangeHint: (minDays, maxDays) => t("retention.rangeHint", { minDays, maxDays }),
    }),
    [t],
  );

  const [repository, setRepository] = useState<RepositorySummary | null>(null);
  const [workspaceData, setWorkspaceData] = useState<Workspace | null>(null);
  const [values, setValues] = useState<RepoSettingsFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const applyRetentionCeiling = flags.RETENTION_CEILING;
  const plan = workspaceData?.plan ?? "free";
  const defaultRetentionDays = workspaceData?.default_retention_days ?? 30;

  const loadSettings = useCallback(async () => {
    if (!workspace) {
      if (workspaceStatus === "unresolved") {
        setLoading(false);
        setLoadError(true);
      }
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const [repo, workspaceSettings] = await Promise.all([
        workspace.get<RepositorySummary>(`/repositories/${repoId}`),
        workspace.get<Workspace>(""),
      ]);
      setRepository(repo);
      setWorkspaceData(workspaceSettings);
      setValues(repositoryToFormValues(repo, workspaceSettings.default_retention_days));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [repoId, workspace, workspaceStatus]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const effectiveRetentionDays = useMemo(() => {
    if (!values) {
      return defaultRetentionDays;
    }

    if (values.usePlanDefault) {
      return defaultRetentionDays;
    }

    const parsed = Number(values.customRetentionDays);
    if (!Number.isFinite(parsed)) {
      return defaultRetentionDays;
    }

    return parsed;
  }, [defaultRetentionDays, values]);

  const hasChanges = useMemo(() => {
    if (!repository || !values) {
      return false;
    }

    return repoSettingsHasChanges(values, repository, {
      plan,
      applyRetentionCeiling,
    });
  }, [applyRetentionCeiling, plan, repository, values]);

  const formValid = values
    ? isRepoSettingsFormValid(values, plan, applyRetentionCeiling)
    : false;

  const canSave = canMutate && hasChanges && formValid && !saving;

  const retentionHint = retentionRangeHint(plan, applyRetentionCeiling, repoSettingsLabels);
  const confirmRepoName = repository ? parseRepoFullName(repository.full_name).name : "";

  const handleSave = useCallback(async () => {
    if (!workspace || !repository || !values || !canSave) {
      return;
    }

    const patch = buildRepositorySettingsPatch(values, repository, {
      plan,
      applyRetentionCeiling,
    });

    if (!patch) {
      return;
    }

    const previousRepository = repository;
    const optimisticRepository: RepositorySummary = {
      ...repository,
      polling_interval_seconds:
        patch.polling_interval_seconds !== undefined
          ? patch.polling_interval_seconds
          : repository.polling_interval_seconds,
      retention_days:
        patch.retention_days !== undefined ? patch.retention_days : repository.retention_days,
    };

    setSaving(true);
    setRepository(optimisticRepository);

    try {
      const updated = await workspace.patch<RepositorySummary>(
        `/repositories/${repoId}`,
        patch,
      );
      setRepository(updated);
      setValues(repositoryToFormValues(updated, defaultRetentionDays));
      toast({
        title: t("toast.savedTitle"),
        variant: "success",
      });
    } catch {
      setRepository(previousRepository);
      setValues(repositoryToFormValues(previousRepository, defaultRetentionDays));
      toast({
        title: t("toast.saveErrorTitle"),
        description: t("toast.saveErrorDescription"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [
    applyRetentionCeiling,
    canSave,
    defaultRetentionDays,
    plan,
    repoId,
    repository,
    t,
    toast,
    values,
    workspace,
  ]);

  const handleToggleEnabled = useCallback(async () => {
    if (!workspace || !repository || !canMutate || togglingEnabled) {
      return;
    }

    const nextEnabled = !repository.enabled;
    const previousRepository = repository;
    setTogglingEnabled(true);
    setRepository({ ...repository, enabled: nextEnabled });

    try {
      const updated = await workspace.patch<RepositorySummary>(`/repositories/${repoId}`, {
        enabled: nextEnabled,
      });
      setRepository(updated);
      toast({
        title: nextEnabled ? t("toast.enabledTitle") : t("toast.disabledTitle"),
        variant: "success",
      });
    } catch {
      setRepository(previousRepository);
      toast({
        title: nextEnabled ? t("toast.enableErrorTitle") : t("toast.disableErrorTitle"),
        variant: "error",
      });
    } finally {
      setTogglingEnabled(false);
    }
  }, [canMutate, repoId, repository, t, toast, togglingEnabled, workspace]);

  const handleDelete = useCallback(async () => {
    if (!workspace || !repository || !canMutate) {
      return;
    }

    setDeleting(true);
    try {
      await workspace.delete(`/repositories/${repoId}`);
      toast({
        title: t("toast.deletedTitle"),
        variant: "success",
      });
      setDeleteOpen(false);
      router.replace(workspaceSlug ? `/workspaces/${workspaceSlug}` : "/");
    } catch {
      toast({
        title: t("toast.deleteErrorTitle"),
        description: t("toast.deleteErrorDescription"),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }, [canMutate, repoId, repository, router, t, toast, workspace, workspaceSlug]);

  if (loading) {
    return <CardSkeleton count={3} />;
  }

  if (loadError || !repository || !values) {
    return (
      <ErrorRetry
        message={t("loadError")}
        onRetry={() => {
          void loadSettings();
        }}
      />
    );
  }

  return (
    <div className="pw-repo-settings">
      <header className="pw-repo-settings-header">
        <h1>{t("title")}</h1>
        <div className="pw-repo-settings-repo-row" style={{ marginTop: 12 }}>
          <span className="pw-repo-settings-repo-name">{repository.full_name}</span>
          {!repository.enabled ? (
            <span className="pw-repo-settings-disabled-badge">{t("disabledBadge")}</span>
          ) : null}
          <a
            href={githubRepoUrl(repository.full_name)}
            target="_blank"
            rel="noopener noreferrer"
            className="pw-repo-settings-github-link"
            aria-label={t("openOnGithubAriaLabel", { fullName: repository.full_name })}
          >
            <Github size={16} aria-hidden />
          </a>
        </div>
        {workspaceSlug ? (
          <p style={{ marginTop: 12 }}>
            <Link href={`/workspaces/${workspaceSlug}/repos/${repoId}`}>
              {t("backToRepo")}
            </Link>
          </p>
        ) : null}
      </header>

      <section className="pw-repo-settings-section" aria-labelledby="pw-repo-sync-title">
        <h2 id="pw-repo-sync-title" className="pw-repo-settings-section-title">
          {t("syncMode.title")}
        </h2>
        <RadioGroup
          name="repo-sync-mode"
          value={values.syncMode}
          onChange={(nextMode) => {
            setValues((current) =>
              current
                ? {
                    ...current,
                    syncMode: nextMode as SyncMode,
                  }
                : current,
            );
          }}
          disabled={!canMutate}
          options={[
            {
              value: "webhook",
              label: t("syncMode.webhookLabel"),
              hint: t("syncMode.webhookHint"),
            },
            {
              value: "polling",
              label: t("syncMode.pollingLabel"),
              hint: t("syncMode.pollingHint"),
            },
          ]}
        />
        {values.syncMode === "polling" ? (
          <div className="pw-repo-settings-polling-row">
            <label htmlFor="pw-repo-polling-interval" className="pw-repo-settings-polling-label">
              {t("syncMode.pollIntervalLabel")}
            </label>
            <Input
              id="pw-repo-polling-interval"
              type="number"
              min={30}
              value={values.pollingInterval}
              onChange={(event) => {
                setValues((current) =>
                  current ? { ...current, pollingInterval: event.target.value } : current,
                );
              }}
              disabled={!canMutate}
              mono
              style={{ width: 80 }}
            />
            <span className="pw-repo-settings-polling-hint">
              {t("syncMode.pollIntervalHint")}
            </span>
          </div>
        ) : null}
      </section>

      <section className="pw-repo-settings-section" aria-labelledby="pw-repo-retention-title">
        <h2 id="pw-repo-retention-title" className="pw-repo-settings-section-title">
          {t("retention.title")}
        </h2>
        <Switch
          label={planDefaultRetentionLabel(defaultRetentionDays, repoSettingsLabels)}
          checked={values.usePlanDefault}
          onChange={(checked) => {
            setValues((current) =>
              current ? { ...current, usePlanDefault: checked } : current,
            );
          }}
          disabled={!canMutate}
        />
        {!values.usePlanDefault ? (
          <div className="pw-repo-settings-retention-row">
            <Input
              label={t("retention.keepRunsFor")}
              type="number"
              min={applyRetentionCeiling ? 30 : 1}
              value={values.customRetentionDays}
              onChange={(event) => {
                setValues((current) =>
                  current ? { ...current, customRetentionDays: event.target.value } : current,
                );
              }}
              disabled={!canMutate}
              mono
              suffix={<span>{t("retention.daysSuffix")}</span>}
            />
            {retentionHint ? (
              <p className="pw-repo-settings-retention-hint">{retentionHint}</p>
            ) : null}
          </div>
        ) : null}
        <div className="pw-repo-settings-effective">
          <Clock3 size={13} aria-hidden />
          <span>
            {t("retention.effectivePrefix")}{" "}
            <strong>
              {String(getEffectiveRetentionDays(
                values.usePlanDefault ? null : effectiveRetentionDays,
                defaultRetentionDays,
              ))}{" "}
              {t("retention.daysSuffix")}
            </strong>{" "}
            {t("retention.effectiveSuffix")}
          </span>
        </div>
      </section>

      <div className="pw-repo-settings-actions">
        <Button disabled={!canSave} loading={saving} onClick={() => void handleSave()}>
          {saving ? t("saveSaving") : t("saveSettings")}
        </Button>
      </div>

      <DangerZone id="pw-repo-danger-zone" title={tUi("dangerZone.title")}>
        <DangerZoneItem
          title={
            repository.enabled ? t("danger.disableTitle") : t("danger.enableTitle")
          }
          description={
            repository.enabled
              ? t("danger.disableDescription")
              : t("danger.enableDescription")
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={!canMutate || togglingEnabled}
              loading={togglingEnabled}
              onClick={() => void handleToggleEnabled()}
            >
              {repository.enabled ? t("danger.disable") : t("danger.enable")}
            </Button>
          }
        />
        <DangerZoneItem
          title={t("danger.deleteTitle")}
          description={t("danger.deleteDescription")}
          action={
            <Button
              variant="danger"
              size="sm"
              disabled={!canMutate}
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              {t("danger.deleteButton")}
            </Button>
          }
        />
      </DangerZone>

      <TypedConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={t("danger.deleteConfirmTitle", { repoName: confirmRepoName })}
        description={t("danger.deleteConfirmDescription", { fullName: repository.full_name })}
        confirmLabel={t("danger.deleteConfirmLabel")}
        cancelLabel={tUi("typedConfirm.cancel")}
        expectedPhrase={confirmRepoName}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        phraseLabel={
          <>
            {tUi("typedConfirm.phrasePrefix")}{" "}
            <strong className="pw-typed-confirm-phrase">{confirmRepoName}</strong>{" "}
            {tUi("typedConfirm.phraseSuffix")}
          </>
        }
        loading={deleting}
      />
    </div>
  );
}

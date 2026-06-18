"use client";

import { flags } from "@pipewatch/config/edition";
import type { RepositorySummary, Workspace } from "@pipewatch/types";
import { Clock3, Github } from "lucide-react";
import Link from "next/link";
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
  const { workspace, workspaceSlug } = useApi();
  const { canMutate } = useWorkspaceRole();
  const { toast } = useToast();

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
      setLoading(false);
      setLoadError(true);
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
  }, [repoId, workspace]);

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

  const retentionHint = retentionRangeHint(plan, applyRetentionCeiling);
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
        title: "Repository settings saved",
        variant: "success",
      });
    } catch {
      setRepository(previousRepository);
      setValues(repositoryToFormValues(previousRepository, defaultRetentionDays));
      toast({
        title: "Could not save settings",
        description: "Check your inputs and try again.",
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
        title: nextEnabled ? "Repository enabled" : "Repository disabled",
        variant: "success",
      });
    } catch {
      setRepository(previousRepository);
      toast({
        title: nextEnabled ? "Could not enable repository" : "Could not disable repository",
        variant: "error",
      });
    } finally {
      setTogglingEnabled(false);
    }
  }, [canMutate, repoId, repository, toast, togglingEnabled, workspace]);

  const handleDelete = useCallback(async () => {
    if (!workspace || !repository || !canMutate) {
      return;
    }

    setDeleting(true);
    try {
      await workspace.delete(`/repositories/${repoId}`);
      toast({
        title: "Repository data deleted",
        variant: "success",
      });
      setDeleteOpen(false);
      router.replace(workspaceSlug ? `/workspaces/${workspaceSlug}` : "/");
    } catch {
      toast({
        title: "Could not delete repository data",
        description: "Try again in a moment.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }, [canMutate, repoId, repository, router, toast, workspace, workspaceSlug]);

  if (loading) {
    return <CardSkeleton count={3} />;
  }

  if (loadError || !repository || !values) {
    return (
      <ErrorRetry
        message="We could not load repository settings. Check your connection and try again."
        onRetry={() => {
          void loadSettings();
        }}
      />
    );
  }

  return (
    <div className="pw-repo-settings">
      <header className="pw-repo-settings-header">
        <h1>Repository settings</h1>
        <div className="pw-repo-settings-repo-row" style={{ marginTop: 12 }}>
          <span className="pw-repo-settings-repo-name">{repository.full_name}</span>
          {!repository.enabled ? (
            <span className="pw-repo-settings-disabled-badge">Disabled</span>
          ) : null}
          <a
            href={githubRepoUrl(repository.full_name)}
            target="_blank"
            rel="noopener noreferrer"
            className="pw-repo-settings-github-link"
            aria-label={`Open ${repository.full_name} on GitHub`}
          >
            <Github size={16} aria-hidden />
          </a>
        </div>
        {workspaceSlug ? (
          <p style={{ marginTop: 12 }}>
            <Link href={`/workspaces/${workspaceSlug}/repos/${repoId}`}>
              Back to repository
            </Link>
          </p>
        ) : null}
      </header>

      <section className="pw-repo-settings-section" aria-labelledby="pw-repo-sync-title">
        <h2 id="pw-repo-sync-title" className="pw-repo-settings-section-title">
          Sync mode
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
              label: "Webhook",
              hint: "GitHub sends events in real time. Requires a public endpoint.",
            },
            {
              value: "polling",
              label: "Polling",
              hint: "PipeWatch polls GitHub periodically. No public endpoint required.",
            },
          ]}
        />
        {values.syncMode === "polling" ? (
          <div className="pw-repo-settings-polling-row">
            <label htmlFor="pw-repo-polling-interval" className="pw-repo-settings-polling-label">
              Poll interval
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
              seconds (minimum 30)
            </span>
          </div>
        ) : null}
      </section>

      <section className="pw-repo-settings-section" aria-labelledby="pw-repo-retention-title">
        <h2 id="pw-repo-retention-title" className="pw-repo-settings-section-title">
          Data retention
        </h2>
        <Switch
          label={planDefaultRetentionLabel(defaultRetentionDays)}
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
              label="Keep runs for"
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
              suffix={<span>days</span>}
            />
            {retentionHint ? (
              <p className="pw-repo-settings-retention-hint">{retentionHint}</p>
            ) : null}
          </div>
        ) : null}
        <div className="pw-repo-settings-effective">
          <Clock3 size={13} aria-hidden />
          <span>
            Runs older than{" "}
            <strong>{String(getEffectiveRetentionDays(
              values.usePlanDefault ? null : effectiveRetentionDays,
              defaultRetentionDays,
            ))}{" "}
            days</strong>{" "}
            are automatically deleted
          </span>
        </div>
      </section>

      <div className="pw-repo-settings-actions">
        <Button disabled={!canSave} loading={saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <DangerZone id="pw-repo-danger-zone">
        <DangerZoneItem
          title={repository.enabled ? "Disable this repository" : "Enable this repository"}
          description={
            repository.enabled
              ? "Stops syncing. Existing run data is preserved."
              : "Resume syncing runs from GitHub for this repository."
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={!canMutate || togglingEnabled}
              loading={togglingEnabled}
              onClick={() => void handleToggleEnabled()}
            >
              {repository.enabled ? "Disable" : "Enable"}
            </Button>
          }
        />
        <DangerZoneItem
          title="Delete repository data"
          description="Permanently deletes all run history for this repository. This cannot be undone."
          action={
            <Button
              variant="danger"
              size="sm"
              disabled={!canMutate}
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              Delete all data
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
        title={`Delete all data for ${confirmRepoName}?`}
        description={`This will permanently delete all runs, jobs, and steps for ${repository.full_name}. This cannot be undone.`}
        confirmLabel="Delete all data"
        expectedPhrase={confirmRepoName}
        loading={deleting}
      />
    </div>
  );
}

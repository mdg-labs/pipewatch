"use client";

import { flags } from "@pipewatch/config/edition";
import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { SlugAvailability, UpdateWorkspaceInput, Workspace, WorkspacePlan } from "@pipewatch/types";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  DangerZone,
  DangerZoneItem,
  Input,
  Select,
  TypedConfirmDialog,
} from "@pipewatch/ui";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import { isBillingNavEnabled } from "@/lib/edition-guards";
import { isValidWorkspaceSlug } from "@/lib/workspace-slug";
import { useToast } from "@/providers/ToastProvider";

import "./workspace-settings.css";

type SlugCheckState = "idle" | "checking" | "available" | "unavailable" | "invalid" | "unchanged";

function buildRetentionOptions(
  plan: WorkspacePlan,
  t: ReturnType<typeof useTranslations<"settings.general">>,
): Array<{ value: string; label: string }> {
  const { minRetentionDays, maxRetentionDays } = getPlanLimits(plan);
  const options: Array<{ value: string; label: string }> = [];

  for (let days = minRetentionDays; days <= maxRetentionDays; days += 30) {
    options.push({
      value: String(days),
      label: t("retentionDays", { days }),
    });
  }

  if (options.length === 0 || options[options.length - 1]?.value !== String(maxRetentionDays)) {
    options.push({
      value: String(maxRetentionDays),
      label: t("retentionDays", { days: maxRetentionDays }),
    });
  }

  return options;
}

function isPaidPlan(plan: WorkspacePlan): boolean {
  return plan === "pro" || plan === "business";
}

/** Workspace general settings form — name, slug, plan summary, retention, delete (B8). */
export function WorkspaceGeneralForm() {
  const router = useRouter();
  const { api, workspace, workspaceId, workspaceStatus, workspaceSlug, workspaces } =
    useApi();
  const { canMutate, meetsMinimum } = useWorkspaceRole();
  const { toast } = useToast();
  const t = useTranslations("settings.general");
  const tUi = useTranslations("ui");

  const [workspaceData, setWorkspaceData] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [originalSlug, setOriginalSlug] = useState("");
  const [retentionDays, setRetentionDays] = useState("30");
  const [slugState, setSlugState] = useState<SlugCheckState>("idle");

  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadWorkspace = useCallback(async () => {
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
      const data = await workspace.get<Workspace>("");
      setWorkspaceData(data);
      setName(data.name);
      setSlug(data.slug);
      setOriginalSlug(data.slug);
      setRetentionDays(String(data.default_retention_days));
      setSlugState("unchanged");
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspaceStatus]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const trimmed = slug.trim();

    if (trimmed === originalSlug) {
      setSlugState("unchanged");
      return;
    }

    if (!isValidWorkspaceSlug(trimmed)) {
      setSlugState("invalid");
      return;
    }

    setSlugState("checking");
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ slug: trimmed });
      if (workspaceId) {
        params.set("exclude", workspaceId);
      }

      void api
        .get<SlugAvailability>(`/workspaces/check-slug?${params.toString()}`)
        .then((result) => {
          setSlugState(result.available ? "available" : "unavailable");
        })
        .catch(() => {
          setSlugState("invalid");
        });
    }, 300);

    return () => {
      window.clearTimeout(handle);
    };
  }, [api, slug, originalSlug, workspaceId]);

  const slugChanged = slug.trim() !== originalSlug;
  const slugReady = slugState === "unchanged" || slugState === "available";

  const hasChanges = useMemo(() => {
    if (!workspaceData) {
      return false;
    }

    const retentionChanged =
      flags.BILLING_ENABLED &&
      isPaidPlan(workspaceData.plan) &&
      Number(retentionDays) !== workspaceData.default_retention_days;

    return (
      name.trim() !== workspaceData.name ||
      slug.trim() !== workspaceData.slug ||
      retentionChanged
    );
  }, [name, retentionDays, slug, workspaceData]);

  const canSave = canMutate && hasChanges && name.trim().length > 0 && slugReady && !saving;

  const onlyWorkspaceOnCe = flags.IS_CE && workspaces.length <= 1;
  const canDelete = meetsMinimum("owner") && !onlyWorkspaceOnCe;

  const slugHint = (() => {
    switch (slugState) {
      case "checking":
        return (
          <span className="pw-workspace-slug-status pw-workspace-slug-checking">
            {t("slugChecking")}
          </span>
        );
      case "available":
        return (
          <span className="pw-workspace-slug-status pw-workspace-slug-available">
            {t("slugAvailable", { slug: slug.trim() })}
          </span>
        );
      case "unavailable":
        return (
          <span className="pw-workspace-slug-status pw-workspace-slug-unavailable">
            {t("slugTaken")}
          </span>
        );
      case "invalid":
        return (
          <span className="pw-workspace-slug-status pw-workspace-slug-unavailable">
            {t("slugInvalid")}
          </span>
        );
      default:
        return null;
    }
  })();

  const handleSave = useCallback(async () => {
    if (!workspace || !workspaceData || !canSave) {
      return;
    }

    const body: UpdateWorkspaceInput = {};
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (trimmedName !== workspaceData.name) {
      body.name = trimmedName;
    }

    if (trimmedSlug !== workspaceData.slug) {
      body.slug = trimmedSlug;
    }

    if (
      flags.BILLING_ENABLED &&
      isPaidPlan(workspaceData.plan) &&
      Number(retentionDays) !== workspaceData.default_retention_days
    ) {
      body.default_retention_days = Number(retentionDays);
    }

    if (Object.keys(body).length === 0) {
      return;
    }

    setSaving(true);
    try {
      const updated = await workspace.patch<Workspace>("", body);
      setWorkspaceData(updated);
      setOriginalSlug(updated.slug);
      setSlugState("unchanged");

      toast({
        title: t("toast.savedTitle"),
        variant: "success",
      });

      if (updated.slug !== workspaceSlug) {
        router.replace(`/workspaces/${updated.slug}/settings`);
      } else {
        router.refresh();
      }
    } catch {
      toast({
        title: t("toast.saveErrorTitle"),
        description: t("toast.saveErrorDescription"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    name,
    retentionDays,
    router,
    slug,
    t,
    toast,
    workspaceId,
    workspaceData,
    workspaceSlug,
  ]);

  const handleDelete = useCallback(async () => {
    if (!workspace || !workspaceData || !canDelete) {
      return;
    }

    setDeleting(true);
    try {
      await workspace.delete("");
      toast({
        title: t("toast.deletedTitle"),
        variant: "success",
      });
      setDeleteOpen(false);

      const fallback = workspaces.find((item) => item.id !== workspaceData.id);
      if (fallback) {
        router.replace(`/workspaces/${fallback.slug}`);
      } else {
        router.replace("/");
      }
    } catch {
      toast({
        title: t("toast.deleteErrorTitle"),
        description: onlyWorkspaceOnCe
          ? t("toast.deleteErrorOnlyWorkspace")
          : t("toast.deleteErrorDescription"),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }, [canDelete, onlyWorkspaceOnCe, router, t, toast, workspaceId, workspaceData, workspaces]);

  if (loading) {
    return <CardSkeleton count={2} />;
  }

  if (loadError || !workspaceData) {
    return (
      <ErrorRetry
        message={t("loadError")}
        onRetry={() => {
          void loadWorkspace();
        }}
      />
    );
  }

  const plan = workspaceData.plan;
  const billingEnabled = isBillingNavEnabled();
  const retentionOptions = buildRetentionOptions(plan, t);

  return (
    <div className="pw-workspace-settings">
      <header className="pw-workspace-settings-header">
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>

      <section className="pw-workspace-settings-section" aria-labelledby="pw-ws-general-title">
        <h2 id="pw-ws-general-title" className="pw-workspace-settings-section-title">
          {t("sectionTitle")}
        </h2>

        <Input
          label={t("nameLabel")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          disabled={!canMutate}
          autoComplete="organization"
        />

        <div>
          <Input
            label={t("slugLabel")}
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
            }}
            disabled={!canMutate}
            mono
            prefix={<span>{t("slugPrefix")}</span>}
          />
          {slugHint}
          {slugChanged ? (
            <p className="pw-workspace-slug-warning" role="status">
              {t("slugWarning")}
            </p>
          ) : null}
        </div>

        <div className="pw-workspace-settings-actions">
          <Button disabled={!canSave} loading={saving} onClick={() => void handleSave()}>
            {saving ? t("saveSaving") : t("saveChanges")}
          </Button>
        </div>
      </section>

      {billingEnabled ? (
        <Card
          title={t("planTitle")}
          actions={
            <Link href={`/workspaces/${workspaceSlug}/settings/billing`}>
              <Button variant="secondary" size="sm">
                {t("planManageBilling")}
              </Button>
            </Link>
          }
        >
          <div className="pw-workspace-plan-row">
            <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{t("planCurrent")}</span>
            <Badge variant="accent" pill>
              {t(`planLabels.${plan}`)}
            </Badge>
          </div>
        </Card>
      ) : null}

      {billingEnabled && isPaidPlan(plan) ? (
        <section
          className="pw-workspace-settings-section"
          aria-labelledby="pw-ws-retention-title"
        >
          <h2 id="pw-ws-retention-title" className="pw-workspace-settings-section-title">
            {t("retentionTitle")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            {t("retentionHint")}
          </p>
          <Select
            label={t("retentionLabel")}
            value={retentionDays}
            onChange={setRetentionDays}
            options={retentionOptions}
            disabled={!canMutate}
          />
        </section>
      ) : billingEnabled && plan === "free" ? (
        <section
          className="pw-workspace-settings-section"
          aria-labelledby="pw-ws-retention-title"
        >
          <h2 id="pw-ws-retention-title" className="pw-workspace-settings-section-title">
            {t("retentionTitle")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            {t("retentionFreeFixed", { days: getPlanLimits("free").maxRetentionDays })}
          </p>
        </section>
      ) : null}

      {meetsMinimum("owner") ? (
        <DangerZone id="pw-ws-danger-zone" title={tUi("dangerZone.title")}>
          <DangerZoneItem
            title={t("deleteTitle")}
            description={
              onlyWorkspaceOnCe ? t("deleteDescriptionCe") : t("deleteDescription")
            }
            action={
              <Button
                variant="danger"
                size="sm"
                disabled={!canDelete}
                onClick={() => {
                  setDeleteOpen(true);
                }}
              >
                {t("deleteButton")}
              </Button>
            }
          />
        </DangerZone>
      ) : null}

      <TypedConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("deleteButton")}
        cancelLabel={tUi("typedConfirm.cancel")}
        expectedPhrase={workspaceData.name}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        phraseLabel={
          <>
            {tUi("typedConfirm.phrasePrefix")}{" "}
            <strong className="pw-typed-confirm-phrase">{workspaceData.name}</strong>{" "}
            {tUi("typedConfirm.phraseSuffix")}
          </>
        }
        loading={deleting}
      />
    </div>
  );
}

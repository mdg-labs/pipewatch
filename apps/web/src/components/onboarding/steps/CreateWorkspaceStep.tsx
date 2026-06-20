"use client";

import { flags } from "@pipewatch/config/edition";
import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { SlugAvailability, Workspace, WorkspacePlan } from "@pipewatch/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Input, RadioGroup } from "@pipewatch/ui";

import { useApi } from "@/hooks/use-api";
import { ApiClientError } from "@/lib/api-client";
import { slugifyWorkspaceName } from "@/lib/onboarding/slug";
import { switchWorkspace } from "@/lib/switch-workspace";
import { publicApiUrl } from "@/lib/env";
import { useToast } from "@/providers/ToastProvider";

export type CreateWorkspaceStepProps = {
  defaultName?: string;
  onCreated: (workspace: Workspace) => void;
};

type SlugCheckState = "idle" | "checking" | "available" | "unavailable" | "invalid";

/** Step 1 — workspace name, slug availability, optional cloud plan selector. */
export function CreateWorkspaceStep({
  defaultName = "",
  onCreated,
}: CreateWorkspaceStepProps) {
  const t = useTranslations("onboarding.createWorkspace");
  const { api } = useApi();
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(() => slugifyWorkspaceName(defaultName));
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState<WorkspacePlan>("free");
  const [slugState, setSlugState] = useState<SlugCheckState>("idle");
  const [submitting, setSubmitting] = useState(false);

  const planOptions = useMemo(
    () =>
      [
        { value: "free" as const, label: t("planFree"), hint: t("planFreeHint") },
        {
          value: "pro" as const,
          label: t("planPro"),
          hint: t("planProHint"),
          disabled: true,
        },
        {
          value: "business" as const,
          label: t("planBusiness"),
          hint: t("planBusinessHint"),
          disabled: true,
        },
      ] satisfies Array<{
        value: WorkspacePlan;
        label: string;
        hint?: string;
        disabled?: boolean;
      }>,
    [t],
  );

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyWorkspaceName(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) {
      setSlugState("invalid");
      return;
    }

    setSlugState("checking");
    const handle = window.setTimeout(() => {
      void api
        .get<SlugAvailability>(`/workspaces/check-slug?slug=${encodeURIComponent(trimmed)}`)
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
  }, [api, slug]);

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      slug.trim().length > 0 &&
      slugState === "available" &&
      !submitting
    );
  }, [name, slug, slugState, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      const workspace = await api.post<Workspace>("/workspaces", {
        name: name.trim(),
        slug: slug.trim(),
      });

      const switched = await switchWorkspace(publicApiUrl, workspace.id);
      if (!switched.ok) {
        toast({
          title: t("toastCreatedTitle"),
          description: t("toastCreatedDescription"),
          variant: "info",
        });
      }

      onCreated(workspace);
    } catch (error) {
      const apiMessage =
        error instanceof ApiClientError ? error.message : null;
      const apiCode = error instanceof ApiClientError ? error.code : null;
      toast({
        title:
          apiCode === "FORBIDDEN"
            ? t("toastForbiddenTitle")
            : t("toastErrorTitle"),
        description:
          apiMessage ?? t("toastErrorDescription"),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [api, canSubmit, name, onCreated, slug, t, toast]);

  const slugHint = (() => {
    switch (slugState) {
      case "checking":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-checking">
            {t("slugChecking")}
          </span>
        );
      case "available":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-available">
            {t("slugAvailable", { slug: slug.trim() })}
          </span>
        );
      case "unavailable":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-unavailable">
            {t("slugTaken")}
          </span>
        );
      case "invalid":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-unavailable">
            {t("slugInvalid")}
          </span>
        );
      default:
        return null;
    }
  })();

  const freeRepoLimit = getPlanLimits("free").repoLimit;

  return (
    <>
      <div className="pw-onboarding-card-header">
        <h1 className="pw-onboarding-card-title">{t("title")}</h1>
        <p className="pw-onboarding-card-subtitle">{t("subtitle")}</p>
      </div>

      <div className="pw-onboarding-card-body">
        <Input
          label={t("nameLabel")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder={t("namePlaceholder")}
          autoComplete="organization"
        />

        <Input
          label={t("slugLabel")}
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          mono
          prefix={<span>{t("slugPrefix")}</span>}
        />
        {slugHint}

        {flags.PLAN_LIMITS_ENABLED ? (
          <div style={{ marginTop: "var(--space-5)" }}>
            <RadioGroup
              label={t("planLabel")}
              name="workspace-plan"
              value={plan}
              onChange={(value) => {
                setPlan(value as WorkspacePlan);
              }}
              options={planOptions}
            />
            <p className="pw-onboarding-plan-hint">
              {t("planLimitHint", { repoLimit: freeRepoLimit ?? 10 })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="pw-onboarding-card-footer">
        <div className="pw-onboarding-card-footer-actions">
          <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {submitting ? t("submitCreating") : t("submitCreate")}
          </Button>
        </div>
      </div>
    </>
  );
}

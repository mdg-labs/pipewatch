"use client";

import { flags } from "@pipewatch/config/edition";
import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { SlugAvailability, Workspace, WorkspacePlan } from "@pipewatch/types";
import { useCallback, useEffect, useMemo, useState } from "react";

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

const PLAN_OPTIONS: Array<{
  value: WorkspacePlan;
  label: string;
  hint?: string;
  disabled?: boolean;
}> = [
  { value: "free", label: "Free", hint: "Up to 10 repos, 30-day retention" },
  {
    value: "pro",
    label: "Pro",
    hint: "Upgrade after setup — 50 repos, longer retention",
    disabled: true,
  },
  {
    value: "business",
    label: "Business",
    hint: "Upgrade after setup — unlimited repos",
    disabled: true,
  },
];

/** Step 1 — workspace name, slug availability, optional cloud plan selector. */
export function CreateWorkspaceStep({
  defaultName = "",
  onCreated,
}: CreateWorkspaceStepProps) {
  const { api } = useApi();
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(() => slugifyWorkspaceName(defaultName));
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState<WorkspacePlan>("free");
  const [slugState, setSlugState] = useState<SlugCheckState>("idle");
  const [submitting, setSubmitting] = useState(false);

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
          title: "Workspace created",
          description: "Sign in again if GitHub setup fails.",
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
            ? "Cannot create workspace"
            : "Could not create workspace",
        description:
          apiMessage ?? "Check the name and slug, then try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [api, canSubmit, name, onCreated, slug, toast]);

  const slugHint = (() => {
    switch (slugState) {
      case "checking":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-checking">
            Checking availability…
          </span>
        );
      case "available":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-available">
            {slug.trim()} is available
          </span>
        );
      case "unavailable":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-unavailable">
            This slug is already taken
          </span>
        );
      case "invalid":
        return (
          <span className="pw-onboarding-slug-status pw-onboarding-slug-unavailable">
            Enter a valid slug (letters, numbers, hyphens)
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
        <h1 className="pw-onboarding-card-title">Create your workspace</h1>
        <p className="pw-onboarding-card-subtitle">
          A workspace groups the repositories you want to monitor together.
        </p>
      </div>

      <div className="pw-onboarding-card-body">
        <Input
          label="Workspace name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Acme Engineering"
          autoComplete="organization"
        />

        <Input
          label="URL slug"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          mono
          prefix={<span>/workspaces/</span>}
        />
        {slugHint}

        {flags.PLAN_LIMITS_ENABLED ? (
          <div style={{ marginTop: "var(--space-5)" }}>
            <RadioGroup
              label="Plan"
              name="workspace-plan"
              value={plan}
              onChange={(value) => {
                setPlan(value as WorkspacePlan);
              }}
              options={PLAN_OPTIONS}
            />
            <p className="pw-onboarding-plan-hint">
              Free includes up to {freeRepoLimit ?? 10} repos. Upgrade anytime in
              billing settings.
            </p>
          </div>
        ) : null}
      </div>

      <div className="pw-onboarding-card-footer">
        <div className="pw-onboarding-card-footer-actions">
          <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {submitting ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </div>
    </>
  );
}

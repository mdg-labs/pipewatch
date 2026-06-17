"use client";

import { flags } from "@pipewatch/config/edition";
import type { IntegrationSummary, Workspace, WorkspaceListItem } from "@pipewatch/types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, DEFAULT_ONBOARDING_STEPS, LogoWordmark, WizardProgress } from "@pipewatch/ui";

import { useApi } from "@/hooks/use-api";
import {
  clampOnboardingStep,
  parseStepParam,
  resolveOnboardingStep,
  stepToProgressId,
  type OnboardingResumeState,
} from "@/lib/onboarding/steps";
import { switchWorkspace } from "@/lib/switch-workspace";
import { publicApiUrl } from "@/lib/env";

import { CreateWorkspaceStep } from "./steps/CreateWorkspaceStep";
import { DoneStep } from "./steps/DoneStep";
import { InstallGitHubStep } from "./steps/InstallGitHubStep";
import { SelectReposStep } from "./steps/SelectReposStep";

import "./onboarding.css";

export type OnboardingWizardProps = {
  githubAppSlug?: string;
  /** Route base for URL step state — `/onboarding` or `/workspaces/new`. */
  basePath?: string;
  /** Pre-filled workspace name for CE bootstrap (PRD §13). */
  defaultWorkspaceName?: string;
};

type WizardContext = {
  workspace: Workspace | null;
  integration: IntegrationSummary | null;
  enabledRepoCount: number;
};

function pickActiveWorkspace(
  workspaces: readonly WorkspaceListItem[],
  preferredId?: string | null,
): WorkspaceListItem | null {
  if (preferredId) {
    const match = workspaces.find((item) => item.id === preferredId);
    if (match) {
      return match;
    }
  }

  return workspaces[0] ?? null;
}

function buildResumeState(context: WizardContext): OnboardingResumeState {
  return {
    hasWorkspace: context.workspace !== null,
    hasIntegration: context.integration !== null,
    hasEnabledRepos: context.enabledRepoCount > 0,
  };
}

/** Four-step onboarding wizard with URL state and DB resumption (pages B2). */
export function OnboardingWizard({
  githubAppSlug,
  basePath = "/onboarding",
  defaultWorkspaceName,
}: OnboardingWizardProps) {
  const initialWorkspaceName =
    defaultWorkspaceName ?? (flags.IS_CE ? "My Workspace" : "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, claims } = useApi();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [context, setContext] = useState<WizardContext>({
    workspace: null,
    integration: null,
    enabledRepoCount: 0,
  });
  const [completedEnabledCount, setCompletedEnabledCount] = useState(0);

  const urlStep = parseStepParam(searchParams.get("step") ?? undefined);
  const resumeState = buildResumeState(context);
  const activeStep = resolveOnboardingStep(urlStep, resumeState);

  const goToStep = useCallback(
    (step: number) => {
      const next = clampOnboardingStep(step);
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", String(next));
      router.push(`${basePath}?${params.toString()}`);
    },
    [basePath, router, searchParams],
  );

  const loadContext = useCallback(async () => {
    setBootstrapping(true);
    try {
      const workspaces = await api.get<WorkspaceListItem[]>("/workspaces");
      const active = pickActiveWorkspace(workspaces, claims?.workspaceId ?? null);

      if (!active) {
        setContext({ workspace: null, integration: null, enabledRepoCount: 0 });
        return;
      }

      if (claims?.workspaceId !== active.id) {
        await switchWorkspace(publicApiUrl, active.id);
        router.refresh();
      }

      const scoped = api.workspace(active.id);
      const [integrations, repositories] = await Promise.all([
        scoped.get<IntegrationSummary[]>("/integrations").catch(() => [] as IntegrationSummary[]),
        scoped.get<Array<{ enabled: boolean }>>("/repositories").catch(() => []),
      ]);

      const integration = integrations[0] ?? null;
      const enabledRepoCount = repositories.filter((repo) => repo.enabled).length;

      setContext({
        workspace: active,
        integration,
        enabledRepoCount,
      });
    } catch {
      setContext({ workspace: null, integration: null, enabledRepoCount: 0 });
    } finally {
      setBootstrapping(false);
    }
  }, [api, claims?.workspaceId, router]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (bootstrapping) {
      return;
    }

    if (urlStep !== activeStep) {
      goToStep(activeStep);
    }
  }, [activeStep, bootstrapping, goToStep, urlStep]);

  const dashboardHref = context.workspace
    ? `/workspaces/${context.workspace.slug}/`
    : null;

  const progressStepId = stepToProgressId(activeStep);

  const handleWorkspaceCreated = useCallback(
    (workspace: Workspace) => {
      setContext((current) => ({
        ...current,
        workspace,
        integration: null,
        enabledRepoCount: 0,
      }));
      router.refresh();
      goToStep(2);
    },
    [goToStep, router],
  );

  const handleReposComplete = useCallback(
    (count: number) => {
      setCompletedEnabledCount(count);
      setContext((current) => ({
        ...current,
        enabledRepoCount: count,
      }));
      goToStep(4);
    },
    [goToStep],
  );

  const stepContent = useMemo(() => {
    if (bootstrapping) {
      return (
        <div className="pw-onboarding-card-body">
          <p className="pw-onboarding-card-subtitle">Loading your progress…</p>
        </div>
      );
    }

    switch (activeStep) {
      case 1:
        return (
          <CreateWorkspaceStep
            defaultName={initialWorkspaceName}
            onCreated={handleWorkspaceCreated}
          />
        );
      case 2:
        return <InstallGitHubStep {...(githubAppSlug ? { githubAppSlug } : {})} />;
      case 3:
        if (!context.workspace) {
          return null;
        }
        return (
          <SelectReposStep
            workspace={context.workspace}
            onBack={() => goToStep(2)}
            onComplete={handleReposComplete}
          />
        );
      case 4:
        if (!context.workspace) {
          return null;
        }
        return (
          <DoneStep
            workspaceSlug={context.workspace.slug}
            enabledRepoCount={completedEnabledCount || context.enabledRepoCount}
            onBack={() => goToStep(3)}
          />
        );
      default:
        return null;
    }
  }, [
    activeStep,
    bootstrapping,
    completedEnabledCount,
    context.enabledRepoCount,
    context.workspace,
    githubAppSlug,
    initialWorkspaceName,
    goToStep,
    handleReposComplete,
    handleWorkspaceCreated,
  ]);

  return (
    <div className="pw-onboarding-page">
      <header className="pw-onboarding-topbar">
        <LogoWordmark markSize={20} />
        {dashboardHref ? (
          <Link className="pw-onboarding-topbar-link" href={dashboardHref}>
            Back to Dashboard
            <ChevronRight size={12} strokeWidth={1.5} aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </header>

      <main className="pw-onboarding-main">
        <WizardProgress
          className="pw-onboarding-progress"
          steps={DEFAULT_ONBOARDING_STEPS}
          currentStepId={progressStepId}
        />

        <Card className="pw-onboarding-card">{stepContent}</Card>
      </main>
    </div>
  );
}

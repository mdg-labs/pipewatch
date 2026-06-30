import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SessionRecoveryRedirect } from "@/components/auth/SessionRecoveryRedirect";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ApiAuthProvider } from "@/hooks/use-api";
import { ACCESS_COOKIE_NAME, hasAuthSession } from "@/lib/auth-cookies";
import { publicApiUrl } from "@/lib/env";
import { fetchAppConfig } from "@/lib/public-config";
import { fetchAppSession } from "@/lib/server-session";

import "@/components/onboarding/onboarding.css";

/** Onboarding wizard entry — first-run and returning users (pages B2). */
export default async function OnboardingPage() {
  const cookieStore = await cookies();

  if (!hasAuthSession(cookieStore)) {
    redirect("/sign-in?next=/onboarding");
  }

  const initialAccessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
  const session = await fetchAppSession({ accessToken: initialAccessToken });

  // Returning members already have a workspace — never replay the wizard
  // (Page Inventory B2, PRD §13).
  if (session.authenticated && session.workspaces.length > 0) {
    redirect(`/workspaces/${session.activeWorkspaceSlug}`);
  }

  // Bootstrap failed (e.g. expired access token): recover before assuming a
  // brand-new user, otherwise transient failures replay onboarding for existing
  // members.
  if (!session.authenticated) {
    return <SessionRecoveryRedirect fallbackPath="/onboarding" />;
  }

  const { githubAppSlug } = await fetchAppConfig({ apiUrl: publicApiUrl });

  return (
    <ApiAuthProvider initialAccessToken={initialAccessToken}>
      <Suspense fallback={null}>
        <OnboardingWizard
          {...(githubAppSlug ? { githubAppSlug } : {})}
        />
      </Suspense>
    </ApiAuthProvider>
  );
}

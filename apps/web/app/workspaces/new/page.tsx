import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ApiAuthProvider } from "@/hooks/use-api";
import { ACCESS_COOKIE_NAME, hasAuthSession } from "@/lib/auth-cookies";

import "@/components/onboarding/onboarding.css";

/** New workspace wizard — same flow as `/onboarding` (pages B2). */
export default async function NewWorkspacePage() {
  const cookieStore = await cookies();

  if (!hasAuthSession(cookieStore)) {
    redirect("/sign-in?next=/workspaces/new");
  }

  const initialAccessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;

  return (
    <ApiAuthProvider initialAccessToken={initialAccessToken}>
      <Suspense fallback={null}>
        <OnboardingWizard basePath="/workspaces/new" />
      </Suspense>
    </ApiAuthProvider>
  );
}

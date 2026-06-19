import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ApiAuthProvider } from "@/hooks/use-api";
import { ACCESS_COOKIE_NAME, hasAuthSession } from "@/lib/auth-cookies";
import { publicApiUrl } from "@/lib/env";
import { fetchAppConfig } from "@/lib/public-config";

import "@/components/onboarding/onboarding.css";

/** Onboarding wizard entry — first-run and returning users (pages B2). */
export default async function OnboardingPage() {
  const cookieStore = await cookies();

  if (!hasAuthSession(cookieStore)) {
    redirect("/sign-in?next=/onboarding");
  }

  const initialAccessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
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

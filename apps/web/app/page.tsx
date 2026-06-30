import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SessionRecoveryRedirect } from "@/components/auth/SessionRecoveryRedirect";
import { ACCESS_COOKIE_NAME, hasAuthSession } from "@/lib/auth-cookies";
import { fetchAppSession } from "@/lib/server-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
  const session = await fetchAppSession({ accessToken });

  if (session.authenticated) {
    if (session.workspaces.length === 0) {
      redirect("/onboarding");
    }

    redirect(`/workspaces/${session.activeWorkspaceSlug}`);
  }

  // Bootstrap failed (e.g. expired access token). Recover via the refresh cookie
  // before routing so existing members are never sent to onboarding on a
  // transient failure (PRD §13, Page Inventory B1).
  if (hasAuthSession(cookieStore)) {
    return <SessionRecoveryRedirect fallbackPath="/" />;
  }

  redirect("/sign-in?next=/");
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE_NAME } from "@/lib/auth-cookies";
import { fetchAppSession } from "@/lib/server-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
  const session = await fetchAppSession({ accessToken });

  if (session.workspaces.length === 0) {
    redirect("/onboarding");
  }

  redirect(`/workspaces/${session.activeWorkspaceSlug}`);
}

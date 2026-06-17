import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/AppShell";
import { ApiAuthProvider } from "@/hooks/use-api";
import { ACCESS_COOKIE_NAME } from "@/lib/auth-cookies";
import { getPlaceholderSession } from "@/lib/placeholder-session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = getPlaceholderSession();
  const cookieStore = await cookies();
  const initialAccessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;

  return (
    <ApiAuthProvider
      initialAccessToken={initialAccessToken}
      workspaces={session.workspaces}
    >
      <AppShell session={session}>{children}</AppShell>
    </ApiAuthProvider>
  );
}

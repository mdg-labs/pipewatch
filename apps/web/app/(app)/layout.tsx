import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/AppShell";
import { LiveStreamOverrideProvider } from "@/contexts/live-stream-override-context";
import { ApiAuthProvider } from "@/hooks/use-api";
import { ACCESS_COOKIE_NAME } from "@/lib/auth-cookies";
import { fetchAppSession } from "@/lib/server-session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialAccessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
  const session = await fetchAppSession({ accessToken: initialAccessToken });

  return (
    <ApiAuthProvider
      initialAccessToken={initialAccessToken}
      workspaces={session.workspaces}
    >
      <LiveStreamOverrideProvider>
        <AppShell session={session}>{children}</AppShell>
      </LiveStreamOverrideProvider>
    </ApiAuthProvider>
  );
}

import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/AppShell";
import { getPlaceholderSession } from "@/lib/placeholder-session";

export default function AppLayout({ children }: { children: ReactNode }) {
  const session = getPlaceholderSession();

  return <AppShell session={session}>{children}</AppShell>;
}

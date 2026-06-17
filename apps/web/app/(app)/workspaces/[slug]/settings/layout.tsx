import type { ReactNode } from "react";

import { RequireRole } from "@/components/RequireRole";
import { ReadOnlyNotice } from "@/components/ReadOnlyNotice";

export default function WorkspaceSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireRole minimumRole="admin">
      <ReadOnlyNotice />
      {children}
    </RequireRole>
  );
}

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { RequireRole } from "@/components/RequireRole";
import { isBillingNavEnabled } from "@/lib/edition-guards";

export default function WorkspaceBillingLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isBillingNavEnabled()) {
    notFound();
  }

  return <RequireRole minimumRole="owner">{children}</RequireRole>;
}

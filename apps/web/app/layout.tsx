import type { Metadata } from "next";
import type { ReactNode } from "react";

import { flags } from "@pipewatch/config/edition";

import { isBillingNavEnabled, isWorkspaceSwitcherEnabled } from "@/lib/edition-features";

export const metadata: Metadata = {
  title: "PipeWatch",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        data-billing={isBillingNavEnabled() ? "enabled" : "hidden"}
        data-edition={flags.IS_CE ? "ce" : "cloud"}
        data-workspace-switcher={
          isWorkspaceSwitcherEnabled() ? "enabled" : "hidden"
        }
      >
        {children}
      </body>
    </html>
  );
}

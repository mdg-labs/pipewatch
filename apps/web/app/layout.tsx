import "@pipewatch/ui/styles.css";
import "@/styles/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { flags } from "@pipewatch/config/edition";

import { isBillingNavEnabled, isWorkspaceSwitcherEnabled } from "@/lib/edition-guards";
import { publicApiUrl } from "@/lib/env";
import { themeInitScript } from "@/hooks/use-theme";
import { ToastProvider } from "@/providers/ToastProvider";

export const metadata: Metadata = {
  title: "PipeWatch",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        data-api-url={publicApiUrl || undefined}
        data-billing={isBillingNavEnabled() ? "enabled" : "hidden"}
        data-edition={flags.IS_CE ? "ce" : "cloud"}
        data-workspace-switcher={
          isWorkspaceSwitcherEnabled() ? "enabled" : "hidden"
        }
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

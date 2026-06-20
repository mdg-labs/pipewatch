import "@pipewatch/ui/styles.css";
import "@/styles/globals.css";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { flags } from "@pipewatch/config/edition";

import { isBillingNavEnabled, isWorkspaceSwitcherEnabled } from "@/lib/edition-guards";
import { publicApiUrl } from "@/lib/env";
import { themeInitScript } from "@/hooks/use-theme";
import { ToastProvider } from "@/providers/ToastProvider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.metadata");

  return {
    title: t("title"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        data-api-url={publicApiUrl || undefined}
        data-billing={isBillingNavEnabled() ? "enabled" : "hidden"}
        data-edition={flags.IS_CE ? "ce" : "cloud"}
        data-workspace-switcher={
          isWorkspaceSwitcherEnabled() ? "enabled" : "hidden"
        }
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

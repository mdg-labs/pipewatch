import "@pipewatch/ui/styles.css";
import "@/styles/globals.css";
import "@/components/layout/marketing-layout.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { flags } from "@pipewatch/config/edition";

import { UmamiScript } from "@/components/analytics/UmamiScript";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { isUmamiEnabled, isWaitlistEnabled } from "@/lib/edition-features";

export const metadata: Metadata = {
  title: {
    default: "PipeWatch",
    template: "%s · PipeWatch",
  },
  description:
    "Real-time GitHub Actions dashboard across all your repositories — PipeWatch Cloud or self-hosted CE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        data-edition={flags.IS_CE ? "ce" : "cloud"}
        data-umami={isUmamiEnabled() ? "enabled" : "hidden"}
        data-waitlist={isWaitlistEnabled() ? "enabled" : "hidden"}
      >
        <UmamiScript />
        <div className="marketing-shell">
          <MarketingNav />
          <main className="marketing-main">{children}</main>
          <MarketingFooter />
        </div>
      </body>
    </html>
  );
}

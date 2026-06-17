import type { Metadata } from "next";
import type { ReactNode } from "react";

import { flags } from "@pipewatch/config/edition";

import { isUmamiEnabled, isWaitlistEnabled } from "@/lib/edition-features";

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
        data-edition={flags.IS_CE ? "ce" : "cloud"}
        data-umami={isUmamiEnabled() ? "enabled" : "hidden"}
        data-waitlist={isWaitlistEnabled() ? "enabled" : "hidden"}
      >
        {children}
      </body>
    </html>
  );
}

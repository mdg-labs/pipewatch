import { defineMiddleware } from "astro:middleware";

import { flags } from "@pipewatch/config/edition";
import { CUSTOMER_DOCS_URL } from "./lib/marketing-links";

const WAITLIST_PATHS = ["/waitlist", "/unsubscribe"] as const;

function customerDocsRedirect(pathname: string): string | null {
  if (pathname === "/docs" || pathname === "/docs/") {
    return CUSTOMER_DOCS_URL;
  }

  if (pathname.startsWith("/docs/")) {
    return `${CUSTOMER_DOCS_URL}${pathname.slice("/docs".length)}`;
  }

  return null;
}

function isWaitlistRoute(pathname: string): boolean {
  return WAITLIST_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const onRequest = defineMiddleware((context, next) => {
  const docsDestination = customerDocsRedirect(context.url.pathname);
  if (docsDestination) {
    return context.redirect(docsDestination, 308);
  }

  if (!isWaitlistRoute(context.url.pathname)) {
    return next();
  }

  const launchMode = process.env.LAUNCH_MODE ?? "waitlist";
  if (!flags.WAITLIST_ENABLED || launchMode === "live") {
    return context.redirect("/");
  }

  return next();
});

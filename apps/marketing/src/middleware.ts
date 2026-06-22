import { defineMiddleware } from "astro:middleware";

import { flags } from "@pipewatch/config/edition";

const WAITLIST_PATHS = ["/waitlist", "/unsubscribe"] as const;

function isWaitlistRoute(pathname: string): boolean {
  return WAITLIST_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const onRequest = defineMiddleware((context, next) => {
  if (!isWaitlistRoute(context.url.pathname)) {
    return next();
  }

  const launchMode = process.env.LAUNCH_MODE ?? "waitlist";
  if (!flags.WAITLIST_ENABLED || launchMode === "live") {
    return context.redirect("/");
  }

  return next();
});

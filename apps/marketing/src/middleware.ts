import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { flags } from "@pipewatch/config/edition";

const WAITLIST_PATHS = ["/waitlist", "/unsubscribe"] as const;

function isWaitlistRoute(pathname: string): boolean {
  return WAITLIST_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  if (!isWaitlistRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const launchMode = process.env.LAUNCH_MODE ?? "waitlist";
  if (!flags.WAITLIST_ENABLED || launchMode === "live") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/waitlist", "/waitlist/:path*", "/unsubscribe"],
};

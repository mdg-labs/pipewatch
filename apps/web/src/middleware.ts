import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { flags } from "@pipewatch/config/edition";

import { hasAuthSession } from "./lib/auth-cookies";
import { getBootstrapStatusForMiddleware } from "./lib/bootstrap";
import { publicApiUrl } from "./lib/env";

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/setup",
  "/invite",
  "/dev",
  "/_next",
  "/favicon",
];

function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAccountPath(pathname: string): boolean {
  return pathname === "/account" || pathname.startsWith("/account/");
}

function isProtectedAppPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/workspaces") ||
    isOnboardingPath(pathname) ||
    isAccountPath(pathname)
  );
}

function isSetupPath(pathname: string): boolean {
  return pathname === "/setup" || pathname.startsWith("/setup/");
}

function isSignInPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname.startsWith("/sign-in/");
}

function redirectTo(
  request: NextRequest,
  pathname: string,
  next?: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

function needsBootstrapHandling(pathname: string): boolean {
  return (
    flags.BOOTSTRAP_ENABLED &&
    (isSetupPath(pathname) ||
      isSignInPath(pathname) ||
      isProtectedAppPath(pathname))
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (
    !needsBootstrapHandling(pathname) &&
    (!isProtectedAppPath(pathname) || isPublicPath(pathname))
  ) {
    return NextResponse.next();
  }

  const authenticated = hasAuthSession(request.cookies);

  if (flags.BOOTSTRAP_ENABLED) {
    const status = await getBootstrapStatusForMiddleware({ apiUrl: publicApiUrl });

    if (status.bootstrapRequired) {
      if (isSetupPath(pathname)) {
        return NextResponse.next();
      }

      if (
        !authenticated &&
        (isProtectedAppPath(pathname) || isSignInPath(pathname))
      ) {
        return redirectTo(request, "/setup");
      }
    } else if (isSetupPath(pathname)) {
      return redirectTo(request, "/sign-in");
    }
  }

  if (!isProtectedAppPath(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  return redirectTo(request, "/sign-in", pathname);
}

export const config = {
  matcher: ["/", "/setup", "/sign-in", "/onboarding", "/account", "/workspaces/:path*"],
};

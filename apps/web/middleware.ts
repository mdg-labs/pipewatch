import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "./src/lib/auth-cookies";

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/setup",
  "/invite",
  "/dev",
  "/_next",
  "/favicon",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtectedAppPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/workspaces");
}

function hasAuthCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(REFRESH_COOKIE_NAME) ||
    request.cookies.has(ACCESS_COOKIE_NAME)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedAppPath(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (hasAuthCookie(request)) {
    return NextResponse.next();
  }

  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/sign-in";
  signInUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/", "/workspaces/:path*"],
};

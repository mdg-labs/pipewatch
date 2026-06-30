"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { refreshAccessToken } from "@/lib/auth";
import { publicApiUrl } from "@/lib/env";

export type SessionRecoveryRedirectProps = {
  /** Path returned to (as `next`) when recovery fails and re-auth is required. */
  fallbackPath: string;
};

/**
 * Recovers a transient SSR session bootstrap failure. When the access token is
 * expired/missing but the refresh cookie is still valid, the server render
 * cannot rotate cookies, so it defers to this client component: rotate the
 * session, then re-run the server render with a valid token. On failure, send
 * the user to sign-in (PRD §7.1, Page Inventory B1). Rendered only when a
 * refresh cookie is present, so returning members are never mis-routed to
 * onboarding on a transient failure.
 */
export function SessionRecoveryRedirect({
  fallbackPath,
}: SessionRecoveryRedirectProps) {
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) {
      return;
    }
    attempted.current = true;

    let active = true;
    void (async () => {
      const result = await refreshAccessToken({ apiUrl: publicApiUrl });
      if (!active) {
        return;
      }

      if (result.ok) {
        router.refresh();
      } else {
        router.replace(`/sign-in?next=${encodeURIComponent(fallbackPath)}`);
      }
    })();

    return () => {
      active = false;
    };
  }, [router, fallbackPath]);

  return null;
}

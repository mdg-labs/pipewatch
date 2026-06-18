type HeaderGetter = {
  get(name: string): string | undefined;
};

function firstHeaderValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

/**
 * Reconstruct the client-facing request origin behind TLS-terminating proxies.
 * Development fallback only — staging/production must set `PUBLIC_API_URL`.
 */
function resolveRequestOrigin(requestUrl: string, headers: HeaderGetter): string {
  const url = new URL(requestUrl);

  const forwardedProto = firstHeaderValue(headers.get("x-forwarded-proto"));
  if (forwardedProto) {
    url.protocol = forwardedProto.endsWith(":") ? forwardedProto : `${forwardedProto}:`;
  }

  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const host = forwardedHost ?? headers.get("host");
  if (host) {
    if (host.includes(":")) {
      url.host = host;
    } else {
      url.hostname = host;
      url.port = "";
    }
  }

  return url.origin;
}

/** Public API origin for OAuth callbacks — explicit env in hosted/CE production. */
export function resolveApiPublicOrigin(
  env: { PUBLIC_API_URL?: string; NODE_ENV?: string },
  requestUrl: string,
  headers: HeaderGetter,
): string {
  if (env.PUBLIC_API_URL) {
    return env.PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (env.NODE_ENV === "development") {
    return resolveRequestOrigin(requestUrl, headers);
  }

  throw new Error("PUBLIC_API_URL is not configured");
}

/** GitHub OAuth `redirect_uri` — must match the GitHub App callback URL exactly. */
export function buildOAuthCallbackUrl(
  env: { PUBLIC_API_URL?: string; NODE_ENV?: string },
  requestUrl: string,
  headers: HeaderGetter,
): string {
  return `${resolveApiPublicOrigin(env, requestUrl, headers)}/auth/github/callback`;
}

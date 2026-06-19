import type { ApiEnv } from "@pipewatch/config/env";

/** Derive a shared parent domain when app and API hosts differ (e.g. cloud subdomains). */
export function deriveSharedCookieDomain(
  appUrl: string,
  publicApiUrl: string,
): string | undefined {
  const appHost = new URL(appUrl).hostname;
  const apiHost = new URL(publicApiUrl).hostname;

  if (appHost === apiHost) {
    return undefined;
  }

  const appParts = appHost.split(".");
  const apiParts = apiHost.split(".");

  let commonLength = 0;
  for (let i = 1; i <= Math.min(appParts.length, apiParts.length); i++) {
    const appSuffix = appParts.slice(-i).join(".");
    const apiSuffix = apiParts.slice(-i).join(".");
    if (appSuffix === apiSuffix) {
      commonLength = i;
    } else {
      break;
    }
  }

  // Require at least registrable domain (e.g. pipewatch.app).
  if (commonLength < 2) {
    return undefined;
  }

  return appParts.slice(-commonLength).join(".");
}

/** Optional `COOKIE_DOMAIN` override, else derive from `APP_URL` + `PUBLIC_API_URL`. */
export function resolveAuthCookieDomain(
  env: Pick<ApiEnv, "APP_URL" | "PUBLIC_API_URL" | "COOKIE_DOMAIN">,
): string | undefined {
  if (env.COOKIE_DOMAIN) {
    return env.COOKIE_DOMAIN.replace(/^\./, "");
  }

  if (!env.APP_URL || !env.PUBLIC_API_URL) {
    return undefined;
  }

  return deriveSharedCookieDomain(env.APP_URL, env.PUBLIC_API_URL);
}

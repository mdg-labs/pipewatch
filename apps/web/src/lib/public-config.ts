export type AppConfig = {
  githubAppSlug: string | null;
};

export type FetchAppConfigOptions = {
  apiUrl: string;
  fetchImpl?: typeof fetch;
};

/** Fetch public app config from the API at SSR (PRD §13, §23, #175). */
export async function fetchAppConfig(
  options: FetchAppConfigOptions,
): Promise<AppConfig> {
  if (!options.apiUrl) {
    return { githubAppSlug: null };
  }

  const base = options.apiUrl.replace(/\/$/, "");
  const fetchFn = options.fetchImpl ?? fetch;

  try {
    const response = await fetchFn(`${base}/api/v1/public/app-config`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return { githubAppSlug: null };
    }

    const body = (await response.json()) as { github_app_slug?: unknown };
    const slug =
      typeof body.github_app_slug === "string" && body.github_app_slug.trim().length > 0
        ? body.github_app_slug.trim()
        : null;

    return { githubAppSlug: slug };
  } catch {
    return { githubAppSlug: null };
  }
}

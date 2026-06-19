/** Public GitHub App install URL (PRD §13, pages B2). */
export function buildGitHubAppInstallUrl(slug?: string | null): string | null {
  const trimmed = slug?.trim();
  if (!trimmed) {
    return null;
  }

  return `https://github.com/apps/${trimmed}/installations/new`;
}

/** API callback after install or CE manual `installation_id` entry. */
export function buildGitHubInstallCallbackUrl(
  apiUrl: string,
  installationId: string,
): string {
  const base = apiUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ installation_id: installationId.trim() });
  return `${base}/onboarding/github-callback?${params.toString()}`;
}

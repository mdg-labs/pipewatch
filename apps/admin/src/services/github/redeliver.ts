import { createGuardedGitHubFetch } from "@pipewatch/utils";

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubRedeliveryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubRedeliveryError";
    this.status = status;
  }
}

/** Trigger GitHub hook delivery redelivery (Admin PRD §9.3). */
export async function redeliverHookDelivery(
  jwt: string,
  githubDeliveryId: string,
  fetchImpl: typeof fetch = createGuardedGitHubFetch(),
): Promise<void> {
  const response = await fetchImpl(
    `${GITHUB_API_BASE}/app/hook/deliveries/${githubDeliveryId}/attempts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new GitHubRedeliveryError(
      `GitHub hook delivery redelivery failed: ${String(response.status)}`,
      response.status,
    );
  }
}

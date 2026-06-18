import type { ApiEnv } from "@pipewatch/config/env";
import type { GitHubUserProfile } from "@pipewatch/types";

import type { GitHubOAuthClient } from "../services/auth/oauth.js";

/** OAuth code accepted by the E2E mock client (Playwright sign-in flow). */
export const E2E_OAUTH_MOCK_CODE = "pw-e2e-mock-code";

/** GitHub OAuth client ID that enables E2E mock mode in development. */
export const E2E_OAUTH_CLIENT_ID = "e2e-test-client-id";

/** Numeric installation ID for onboarding E2E manual entry. */
export const E2E_INSTALLATION_ID = "999888777";

const E2E_USER_PROFILE: GitHubUserProfile = {
  githubId: 900_001n,
  githubLogin: "e2e-user",
  email: "e2e-user@example.com",
  name: "E2E User",
  avatarUrl: "https://example.com/e2e-avatar.png",
};

/** True when local E2E stack runs with mock GitHub credentials. */
export function isE2eMockEnabled(env: Pick<ApiEnv, "NODE_ENV" | "GITHUB_CLIENT_ID">): boolean {
  return env.NODE_ENV === "development" && env.GITHUB_CLIENT_ID === E2E_OAUTH_CLIENT_ID;
}

/** OAuth client that accepts the fixed E2E mock code without calling GitHub. */
export function createE2eOAuthClient(): GitHubOAuthClient {
  return {
    async exchangeCode(code) {
      if (code !== E2E_OAUTH_MOCK_CODE) {
        throw new Error("Invalid E2E OAuth mock code");
      }

      return E2E_USER_PROFILE;
    },
  };
}

/** Resolve OAuth client — real GitHub in production paths, mock in local E2E. */
export function resolveOAuthClient(
  env: ApiEnv,
  fallback: GitHubOAuthClient,
): GitHubOAuthClient {
  if (isE2eMockEnabled(env)) {
    return createE2eOAuthClient();
  }

  return fallback;
}

/** Mock GitHub App API fetch for E2E install callback. */
export function createE2eGitHubFetch(installationId: string = E2E_INSTALLATION_ID): typeof fetch {
  const token = "ghs_e2e_mock_install_token";
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    if (
      method === "GET" &&
      url === `https://api.github.com/app/installations/${installationId}`
    ) {
      return new Response(
        JSON.stringify({
          account: {
            login: "e2e-org",
            type: "Organization",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      method === "POST" &&
      url === `https://api.github.com/app/installations/${installationId}/access_tokens`
    ) {
      return new Response(JSON.stringify({ token, expires_at: expiresAt }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

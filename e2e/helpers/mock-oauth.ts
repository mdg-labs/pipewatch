import type { Page } from "@playwright/test";

import { E2E_OAUTH_MOCK_CODE } from "./constants.js";

/**
 * Intercept the browser OAuth redirect to GitHub and complete the callback locally.
 * Requires the API E2E mock OAuth client (GITHUB_CLIENT_ID=e2e-test-client-id).
 */
export async function installMockOAuthRoute(page: Page, apiBaseUrl: string): Promise<void> {
  const apiOrigin = apiBaseUrl.replace(/\/$/, "");

  await page.route("https://github.com/login/oauth/authorize**", async (route) => {
    const authorizeUrl = new URL(route.request().url());
    const state = authorizeUrl.searchParams.get("state");
    const redirectUri = authorizeUrl.searchParams.get("redirect_uri");

    if (!state || !redirectUri) {
      await route.abort();
      return;
    }

    const callback = new URL(redirectUri);
    callback.searchParams.set("code", E2E_OAUTH_MOCK_CODE);
    callback.searchParams.set("state", state);

    await route.fulfill({
      status: 302,
      headers: {
        Location: callback.toString(),
      },
    });
  });

  await page.route(`${apiOrigin}/auth/github`, async (route) => {
    await route.continue();
  });
}

import type { Page } from "@playwright/test";

import { installMockOAuthRoute } from "./mock-oauth.js";

/** Complete mock GitHub OAuth sign-in against the ephemeral E2E API. */
export async function signInViaMockOAuth(page: Page, apiBaseUrl: string): Promise<void> {
  await installMockOAuthRoute(page, apiBaseUrl);
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Continue with GitHub" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
    timeout: 20_000,
  });
}

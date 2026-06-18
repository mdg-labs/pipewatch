import type { Page } from "@playwright/test";

import { E2E_INSTALLATION_ID } from "./constants.js";

/** Complete GitHub App install via mocked API callback (cloud + CE). */
export async function completeMockGitHubInstall(page: Page, apiBaseUrl: string): Promise<void> {
  const callbackUrl = `${apiBaseUrl.replace(/\/$/, "")}/onboarding/github-callback?installation_id=${E2E_INSTALLATION_ID}`;
  await page.goto(callbackUrl);
  await page.waitForURL(/step=3/, { timeout: 20_000 });
}

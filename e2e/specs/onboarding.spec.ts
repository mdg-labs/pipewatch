import { randomBytes } from "node:crypto";

import { test, expect } from "@playwright/test";

import { completeMockGitHubInstall } from "../helpers/mock-github-install.js";
import { installMockOAuthRoute } from "../helpers/mock-oauth.js";
import { seedOnboardingRepositories } from "../helpers/seed.js";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";

test.describe("onboarding happy path @local-only", () => {
  test("creates workspace, connects GitHub, selects repos, and finishes", async ({ page }) => {
    test.skip(Boolean(process.env.E2E_APP_URL), "Onboarding E2E requires local ephemeral stack");

    const workspaceSlug = `e2e-${randomBytes(4).toString("hex")}`;
    const workspaceName = `E2E Workspace ${workspaceSlug}`;

    await installMockOAuthRoute(page, apiUrl);
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Continue with GitHub" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

    await page.goto("/onboarding?step=1");
    await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();

    await page.getByLabel("Workspace name").fill(workspaceName);
    await expect(page.getByText(`${workspaceSlug} is available`)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Create workspace" }).click();

    await expect(page).toHaveURL(/step=2/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Install the GitHub App" })).toBeVisible();

    await completeMockGitHubInstall(page, apiUrl);

    const workspaceId = new URL(page.url()).searchParams.get("workspace");
    if (workspaceId) {
      const integrationResponse = await page.request.get(
        `${apiUrl.replace(/\/$/, "")}/api/v1/workspaces/${workspaceId}/integrations`,
      );

      if (integrationResponse.ok()) {
        const integrations = (await integrationResponse.json()) as Array<{ id: string }>;
        const integrationId = integrations[0]?.id;
        if (integrationId) {
          await seedOnboardingRepositories(workspaceId, integrationId);
          await page.reload();
        }
      }
    }

    await expect(page.getByRole("heading", { name: "Select repositories" })).toBeVisible({
      timeout: 20_000,
    });

    const repoRow = page.getByLabel(/Track e2e-org\/alpha/i);
    await expect(repoRow).toBeVisible({ timeout: 15_000 });
    await repoRow.check();
    await page.getByRole("button", { name: "Start syncing" }).click();

    await expect(page).toHaveURL(/step=4/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
  });
});

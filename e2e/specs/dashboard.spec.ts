import { randomBytes } from "node:crypto";

import { test, expect } from "@playwright/test";

import { installMockOAuthRoute } from "../helpers/mock-oauth.js";
import { seedDashboardFixture } from "../helpers/seed.js";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";

test.describe("dashboard and run detail @local-only", () => {
  test("loads dashboard and navigates to run detail", async ({ page }) => {
    test.skip(Boolean(process.env.E2E_APP_URL), "Dashboard seeding requires local ephemeral stack");

    const slug = `dash-${randomBytes(4).toString("hex")}`;
    const fixture = await seedDashboardFixture(slug);

    await installMockOAuthRoute(page, apiUrl);
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Continue with GitHub" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

    await page.goto(`/workspaces/${fixture.workspaceSlug}/`);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Repository health summary" })).toBeVisible();
    await page.locator(".pw-dashboard-repo-card-link, .pw-dashboard-table-row").first().click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${fixture.workspaceSlug}/repos/${fixture.repositoryId}`));

    await page.goto(
      `/workspaces/${fixture.workspaceSlug}/repos/${fixture.repositoryId}/runs/${fixture.runId}`,
    );

    await expect(page.locator(".pw-run-detail-title")).toHaveText("CI", { timeout: 20_000 });
    await expect(page.getByRole("navigation", { name: "Run context" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });
});

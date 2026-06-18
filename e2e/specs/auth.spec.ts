import { test, expect } from "@playwright/test";

import { installMockOAuthRoute } from "../helpers/mock-oauth.js";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";

test.describe("sign-in @staging-smoke", () => {
  test("loads sign-in page on staging deployment", async ({ page }) => {
    test.skip(!process.env.E2E_APP_URL, "Staging smoke runs only when E2E_APP_URL is set");

    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: "Sign in to PipeWatch" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with GitHub" })).toBeVisible();
  });
});

test.describe("sign-in @local-only", () => {
  test("completes mock OAuth sign-in", async ({ page }) => {
    test.skip(Boolean(process.env.E2E_APP_URL), "Mock OAuth requires local ephemeral stack");

    await installMockOAuthRoute(page, apiUrl);

    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: "Sign in to PipeWatch" })).toBeVisible();
    await page.getByRole("link", { name: "Continue with GitHub" }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
      timeout: 20_000,
    });

    await expect(page).not.toHaveURL(/\/sign-in/);
  });
});

import { randomBytes } from "node:crypto";

import { test, expect } from "@playwright/test";

import { expectHttpOk, expectPageHeading, expectRouteOk } from "../helpers/page-smoke.js";
import { seedDashboardFixture } from "../helpers/seed.js";
import { signInViaMockOAuth } from "../helpers/sign-in.js";

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";
const marketingUrl = process.env.E2E_MARKETING_URL;

function isLocalStack(): boolean {
  return !process.env.E2E_APP_URL;
}

function projectEdition(): "cloud" | "ce" {
  return test.info().project.name === "ce" ? "ce" : "cloud";
}

test.describe("page inventory — marketing smoke @all-editions", () => {
  test.beforeEach(() => {
    test.skip(!marketingUrl, "Set E2E_MARKETING_URL to run marketing page smoke tests");
  });

  test("A1 homepage loads", async ({ page }) => {
    await expectPageHeading(page, `${marketingUrl}/`, /all in one place/i);
  });

  test("A2 pricing loads", async ({ page }) => {
    await expectPageHeading(page, `${marketingUrl}/pricing`, /Simple, usage-based pricing/i);
  });

  test("A3 docs index loads", async ({ page }) => {
    await expectRouteOk(page, `${marketingUrl}/docs`);
    await expect(page.getByRole("searchbox").first()).toBeVisible();
  });

  test("A4 changelog loads", async ({ page }) => {
    await expectPageHeading(page, `${marketingUrl}/changelog`, "Changelog");
  });

  test("A5 waitlist loads when enabled", async ({ page }) => {
    const response = await page.goto(`${marketingUrl}/waitlist`);
    const status = response?.status() ?? 0;
    if (status === 404) {
      test.skip(true, "Waitlist disabled in this marketing deployment");
    }
    expect(status).toBeLessThan(500);
  });

  test("A6 legal pages load", async ({ page }) => {
    await expectRouteOk(page, `${marketingUrl}/privacy`);
    await expectRouteOk(page, `${marketingUrl}/terms`);
  });

  test("A7 waitlist confirm route responds", async ({ page }) => {
    await expectRouteOk(page, `${marketingUrl}/waitlist/confirm?token=e2e-invalid`);
  });
});

test.describe("page inventory — app smoke B0–B14 @local-only", () => {
  test.beforeEach(() => {
    test.skip(!isLocalStack(), "App inventory smoke requires local ephemeral stack");
  });

  test("B1 sign-in loads", async ({ page }) => {
    await expectPageHeading(page, "/sign-in", "Sign in to PipeWatch");
  });

  test("B2 onboarding step 1 loads when authenticated", async ({ page }) => {
    await signInViaMockOAuth(page, apiUrl);
    await expectPageHeading(page, "/onboarding?step=1", "Create your workspace");
  });

  test("B3–B7 seeded workspace pages load", async ({ page }) => {
    const slug = `inv-${randomBytes(4).toString("hex")}`;
    const fixture = await seedDashboardFixture(slug);

    await signInViaMockOAuth(page, apiUrl);

    await expectPageHeading(page, `/workspaces/${slug}/`, "Dashboard");
    await expectRouteOk(page, `/workspaces/${slug}/repos/${fixture.repositoryId}`);
    await expectPageHeading(
      page,
      `/workspaces/${slug}/repos/${fixture.repositoryId}/settings`,
      "Repository settings",
    );
    await expectRouteOk(
      page,
      `/workspaces/${slug}/repos/${fixture.repositoryId}/runs/${fixture.runId}`,
    );
    await expectPageHeading(page, `/workspaces/${slug}/insights`, "Insights");
  });

  test("B8–B11 workspace settings pages load", async ({ page }) => {
    const slug = `set-${randomBytes(4).toString("hex")}`;
    await seedDashboardFixture(slug);

    await signInViaMockOAuth(page, apiUrl);

    await expectPageHeading(page, `/workspaces/${slug}/settings`, "General");
    await expectPageHeading(page, `/workspaces/${slug}/settings/members`, "Members");
    await expectPageHeading(page, `/workspaces/${slug}/settings/integrations`, "Integrations");
    await expectPageHeading(page, `/workspaces/${slug}/settings/api-keys`, "API Keys");
  });

  test("B12 billing loads for workspace owner on cloud edition", async ({ page }) => {
    test.skip(projectEdition() !== "cloud", "Billing is cloud-only");

    const slug = `bill-${randomBytes(4).toString("hex")}`;
    await seedDashboardFixture(slug, "owner");

    await signInViaMockOAuth(page, apiUrl);
    await expectPageHeading(page, `/workspaces/${slug}/settings/billing`, "Billing");
  });

  test("B13 account settings loads", async ({ page }) => {
    const slug = `acct-${randomBytes(4).toString("hex")}`;
    await seedDashboardFixture(slug);

    await signInViaMockOAuth(page, apiUrl);
    await expectPageHeading(page, "/account", "Account");
  });

  test("B14 API docs loads from API host", async ({ page }) => {
    await expectHttpOk(page, `${apiUrl.replace(/\/$/, "")}/api/docs`);
  });
});

test.describe("page inventory — edition gating @local-only", () => {
  test.beforeEach(() => {
    test.skip(!isLocalStack(), "Edition gating requires local ephemeral stack");
  });

  test("cloud hides CE bootstrap and shows billing nav", async ({ page }) => {
    test.skip(projectEdition() !== "cloud", "Cloud edition project only");

    const slug = `cld-${randomBytes(4).toString("hex")}`;
    await seedDashboardFixture(slug);

    await signInViaMockOAuth(page, apiUrl);

    const setupResponse = await page.goto("/setup");
    expect(setupResponse?.status()).toBe(404);

    await page.goto(`/workspaces/${slug}/settings`);
    await expect(page.getByRole("link", { name: "Billing" })).toBeVisible();
    await expect(page.locator(".pw-app-workspace-switcher")).toBeVisible();
  });

  test("CE hides billing nav and cloud bootstrap route", async ({ page }) => {
    test.skip(projectEdition() !== "ce", "CE edition project only");

    const slug = `ce-${randomBytes(4).toString("hex")}`;
    await seedDashboardFixture(slug);

    await signInViaMockOAuth(page, apiUrl);
    await page.goto(`/workspaces/${slug}/settings`);

    await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0);
    await expect(page.locator(".pw-app-sidebar-edition")).toHaveText("CE");

    const setupResponse = await page.goto("/setup");
    const status = setupResponse?.status() ?? 0;
    expect(status === 404 || status < 400).toBeTruthy();
  });
});

test.describe("page inventory — role gating @local-only", () => {
  test.beforeEach(() => {
    test.skip(!isLocalStack(), "Role gating requires local ephemeral stack");
  });

  test("member is read-only on B5 and B8–B11", async ({ page }) => {
    const slug = `mem-${randomBytes(4).toString("hex")}`;
    const fixture = await seedDashboardFixture(slug, "member");

    await signInViaMockOAuth(page, apiUrl);

    const readOnlyPaths = [
      `/workspaces/${slug}/repos/${fixture.repositoryId}/settings`,
      `/workspaces/${slug}/settings`,
      `/workspaces/${slug}/settings/members`,
      `/workspaces/${slug}/settings/integrations`,
      `/workspaces/${slug}/settings/api-keys`,
    ];

    for (const path of readOnlyPaths) {
      await page.goto(path);
      await expect(page.getByText("You have read-only access.")).toBeVisible();
    }

    await page.goto(`/workspaces/${slug}/settings/members`);
    await expect(page.getByRole("button", { name: "Invite member" })).toHaveCount(0);

    await page.goto(`/workspaces/${slug}/settings/api-keys`);
    await expect(page.getByRole("button", { name: "Create API key" })).toHaveCount(0);

    await page.goto(`/workspaces/${slug}/repos/${fixture.repositoryId}/settings`);
    await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();
  });

  test("B12 billing requires owner role", async ({ page }) => {
    test.skip(projectEdition() !== "cloud", "Billing is cloud-only");

    const slug = `own-${randomBytes(4).toString("hex")}`;
    await seedDashboardFixture(slug, "member");

    await signInViaMockOAuth(page, apiUrl);
    await page.goto(`/workspaces/${slug}/settings/billing`);

    await expect(page.getByRole("heading", { name: "Insufficient permissions" })).toBeVisible();
  });
});

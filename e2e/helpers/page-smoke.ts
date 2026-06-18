import { expect, type Page } from "@playwright/test";

/** Navigate and assert the response is not a server error. */
export async function expectRouteOk(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect(status, `expected ${path} to load without 5xx (got ${status})`).toBeLessThan(500);
}

/** Navigate and assert a primary heading is visible. */
export async function expectPageHeading(
  page: Page,
  path: string,
  heading: string | RegExp,
): Promise<void> {
  await expectRouteOk(page, path);
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Fetch a URL (e.g. API docs) and assert a successful response. */
export async function expectHttpOk(
  page: Page,
  url: string,
  options?: { acceptNotFound?: boolean },
): Promise<void> {
  const response = await page.request.get(url);
  const status = response.status();

  if (options?.acceptNotFound && status === 404) {
    return;
  }

  expect(status, `expected ${url} to respond without 5xx (got ${status})`).toBeLessThan(500);
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(400);
}

import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

import { DEFAULT_E2E_API_URL, DEFAULT_E2E_APP_URL } from "./helpers/constants.js";

const appUrl = process.env.E2E_APP_URL ?? DEFAULT_E2E_APP_URL;
const apiUrl = process.env.E2E_API_URL ?? DEFAULT_E2E_API_URL;
const isStagingTarget = Boolean(process.env.E2E_APP_URL);

function buildReporters(): ReporterDescription[] {
  const reporters: ReporterDescription[] = [["list"]];

  if (
    process.env.REPORTPORTAL_URL &&
    process.env.REPORTPORTAL_API_KEY &&
    process.env.REPORTPORTAL_PROJECT
  ) {
    reporters.push([
      "@reportportal/agent-js-playwright",
      {
        endpoint: process.env.REPORTPORTAL_URL,
        apiKey: process.env.REPORTPORTAL_API_KEY,
        project: process.env.REPORTPORTAL_PROJECT,
        launch: "PipeWatch E2E",
        attributes: [
          { key: "target", value: isStagingTarget ? "staging" : "local" },
          { key: "edition", value: process.env.PIPEWATCH_EDITION ?? "cloud" },
        ],
      },
    ]);
  }

  return reporters;
}

const localProjects = [
  {
    name: "cloud",
    grepInvert: /@ce-only|@staging-smoke/,
    use: {
      ...devices["Desktop Chrome"],
    },
  },
  {
    name: "ce",
    grep: /@ce-only|@all-editions/,
    grepInvert: /@staging-smoke/,
    use: {
      ...devices["Desktop Chrome"],
    },
  },
];

const stagingProjects = [
  {
    name: "staging",
    grep: /@staging-smoke/,
    use: {
      ...devices["Desktop Chrome"],
    },
  },
];

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: "./test-results",
  reporter: buildReporters(),
  use: {
    baseURL: appUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: isStagingTarget ? stagingProjects : localProjects,
  metadata: {
    apiUrl,
    appUrl,
    target: isStagingTarget ? "staging" : "local",
  },
});

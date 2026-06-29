import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PipelineJob, PipelineStep } from "@pipewatch/types";

import en from "@/i18n/locales/en.json";

import { JobPanel } from "./JobPanel";

const JOB_LOG_URL = "https://github.com/acme/app/actions/runs/1/jobs/2";

const job: PipelineJob = {
  id: "job-1",
  workspace_id: "ws-1",
  run_id: "run-1",
  external_job_id: "ext-job-1",
  name: "test",
  status: "completed",
  conclusion: "success",
  runner_name: "ubuntu-latest",
  source_url: null,
  started_at: "2026-06-10T12:00:00.000Z",
  completed_at: "2026-06-10T12:02:00.000Z",
  duration_ms: 120_000,
};

const steps: PipelineStep[] = [
  {
    id: "step-1",
    job_id: "job-1",
    number: 1,
    name: "Run tests",
    status: "completed",
    conclusion: "success",
    started_at: "2026-06-10T12:00:00.000Z",
    completed_at: "2026-06-10T12:01:00.000Z",
    duration_ms: 60_000,
  },
];

function renderPanel(overrides: Partial<Parameters<typeof JobPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <JobPanel
        job={job}
        steps={steps}
        expanded
        onToggle={vi.fn()}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe("JobPanel", () => {
  it("renders a GitHub log link when source_url is set", () => {
    const html = renderPanel({ job: { ...job, source_url: JOB_LOG_URL } });

    expect(html).toContain(`href="${JOB_LOG_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="View test logs on GitHub"');
    expect(html).toContain("pw-job-panel-log-link");
  });

  it("omits the GitHub log link when source_url is absent", () => {
    const html = renderPanel();

    expect(html).not.toContain("pw-job-panel-log-link");
    expect(html).not.toContain(JOB_LOG_URL);
  });
});

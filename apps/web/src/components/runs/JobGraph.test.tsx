import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PipelineJob } from "@pipewatch/types";

import en from "@/i18n/locales/en.json";

import { JobGraph } from "./JobGraph";

const JOB_LOG_URL = "https://github.com/acme/app/actions/runs/1/jobs/2";

function makeJob(overrides: Partial<PipelineJob> = {}): PipelineJob {
  return {
    id: "job-1",
    workspace_id: "ws-1",
    run_id: "run-1",
    external_job_id: "ext-job-1",
    name: "build",
    status: "completed",
    conclusion: "success",
    runner_name: "ubuntu-latest",
    source_url: null,
    started_at: "2026-06-10T12:00:00.000Z",
    completed_at: "2026-06-10T12:02:00.000Z",
    duration_ms: 120_000,
    ...overrides,
  };
}

function renderGraph(jobs: PipelineJob[]) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <JobGraph jobs={jobs} onJobSelect={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("JobGraph", () => {
  it("renders a GitHub log link when source_url is set", () => {
    const html = renderGraph([makeJob({ source_url: JOB_LOG_URL })]);

    expect(html).toContain(`href="${JOB_LOG_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="View build logs on GitHub"');
  });

  it("omits the GitHub log link when source_url is absent", () => {
    const html = renderGraph([makeJob({ source_url: null })]);

    expect(html).not.toContain("pw-job-graph-node-log-link");
    expect(html).not.toContain(JOB_LOG_URL);
  });
});

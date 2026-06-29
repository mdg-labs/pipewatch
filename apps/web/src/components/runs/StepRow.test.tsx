import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PipelineStep } from "@pipewatch/types";

import en from "@/i18n/locales/en.json";

import { StepRow } from "./StepRow";

const JOB_LOG_URL = "https://github.com/acme/app/actions/runs/1/jobs/2";

const step: PipelineStep = {
  id: "step-1",
  job_id: "job-1",
  number: 3,
  name: "Deploy",
  status: "completed",
  conclusion: "success",
  started_at: "2026-06-10T12:00:00.000Z",
  completed_at: "2026-06-10T12:01:00.000Z",
  duration_ms: 60_000,
};

function renderStep(jobSourceUrl: string | null | undefined = null) {
  const props =
    jobSourceUrl === undefined
      ? { step }
      : { step, jobSourceUrl };

  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <StepRow {...props} />
    </NextIntlClientProvider>,
  );
}

describe("StepRow", () => {
  it("renders a GitHub log link when jobSourceUrl is set", () => {
    const html = renderStep(JOB_LOG_URL);

    expect(html).toContain(`href="${JOB_LOG_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="View Deploy logs on GitHub"');
    expect(html).toContain("pw-step-row-log-link");
  });

  it("omits the GitHub log link when jobSourceUrl is absent", () => {
    const html = renderStep(undefined);

    expect(html).not.toContain("pw-step-row-log-link");
    expect(html).not.toContain(JOB_LOG_URL);
  });
});

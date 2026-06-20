import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmptyState, Skeleton, Toast } from "@pipewatch/ui";

import en from "@/i18n/locales/en.json";

import { CardSkeleton } from "./CardSkeleton";
import { ErrorRetry } from "./ErrorRetry";
import { TableSkeleton } from "./TableSkeleton";

function renderWithIntl(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("Skeleton", () => {
  it("renders a loading placeholder", () => {
    const html = renderToStaticMarkup(
      <Skeleton variant="line" width="100%" height={12} />,
    );

    expect(html).toContain("pw-skeleton");
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("EmptyState", () => {
  it("renders title, description, and actions", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="No runs yet"
        description="Runs appear once webhooks are connected."
        actions={<button type="button">Connect GitHub</button>}
      />,
    );

    expect(html).toContain("pw-empty");
    expect(html).toContain("No runs yet");
    expect(html).toContain("Connect GitHub");
  });
});

describe("Toast", () => {
  it("renders success feedback", () => {
    const html = renderToStaticMarkup(
      <Toast title="Settings saved" variant="success" />,
    );

    expect(html).toContain("pw-toast-success");
    expect(html).toContain('role="status"');
  });
});

describe("TableSkeleton", () => {
  it("renders an accessible loading table", () => {
    const html = renderToStaticMarkup(
      <TableSkeleton columns={3} rows={2} />,
    );

    expect(html).toContain("pw-table-skeleton");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading table"');
  });
});

describe("CardSkeleton", () => {
  it("renders an accessible loading card grid", () => {
    const html = renderToStaticMarkup(<CardSkeleton count={2} />);

    expect(html).toContain("pw-card-skeleton-grid");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading cards"');
  });
});

describe("ErrorRetry", () => {
  it("renders message and retry action", () => {
    const html = renderWithIntl(
      <ErrorRetry
        message="We could not load workflow runs."
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain("pw-error-retry");
    expect(html).toContain('role="alert"');
    expect(html).toContain("We could not load workflow runs.");
    expect(html).toContain("Retry");
  });
});

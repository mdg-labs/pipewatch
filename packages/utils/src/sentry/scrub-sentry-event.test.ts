import { describe, expect, it } from "vitest";

import {
  SENTRY_REDACTED,
  scrubSentryEvent,
  type ScrubbableSentryEvent,
} from "./scrub-sentry-event.js";

describe("scrubSentryEvent", () => {
  it("redacts Authorization and Cookie headers from the request payload", () => {
    const event: ScrubbableSentryEvent = {
      request: {
        headers: {
          Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.test",
          Cookie: "refresh_token=abc123; session=xyz",
          "Content-Type": "application/json",
        },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.headers?.Authorization).toBe(SENTRY_REDACTED);
    expect(scrubbed.request?.headers?.Cookie).toBe(SENTRY_REDACTED);
    expect(scrubbed.request?.headers?.["Content-Type"]).toBe("application/json");
  });

  it("redacts token query params from request URLs", () => {
    const event: ScrubbableSentryEvent = {
      request: {
        url: "https://api.example.com/api/v1/workspaces/ws/repos/r1/stream?token=sse-one-time-token&foo=bar",
        query_string: "token=sse-one-time-token&foo=bar",
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.url).toBe(
      `https://api.example.com/api/v1/workspaces/ws/repos/r1/stream?token=${SENTRY_REDACTED}&foo=bar`,
    );
    expect(scrubbed.request?.query_string).toBe(`token=${SENTRY_REDACTED}&foo=bar`);
  });

  it("redacts known secret patterns from extra fields and request data", () => {
    const event: ScrubbableSentryEvent = {
      request: {
        data: '{"apiKey":"pw_live_abc123","note":"Bearer leaked-token"}',
      },
      extra: {
        GITHUB_WEBHOOK_SECRET: "whsec_test",
        passwordHash: "hashed-value",
        safeField: "visible",
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.data).toContain(SENTRY_REDACTED);
    expect(scrubbed.request?.data).not.toContain("pw_live_abc123");
    expect(scrubbed.extra?.GITHUB_WEBHOOK_SECRET).toBe(SENTRY_REDACTED);
    expect(scrubbed.extra?.passwordHash).toBe(SENTRY_REDACTED);
    expect(scrubbed.extra?.safeField).toBe("visible");
  });
});

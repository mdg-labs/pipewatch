import { describe, expect, it } from "vitest";

import { renderWelcomeEmail } from "./welcome.js";

describe("renderWelcomeEmail", () => {
  it("renders welcome copy with sentence case and no emoji", () => {
    const email = renderWelcomeEmail({
      recipientName: "Alex",
      appUrl: "https://cloud.pipewatch.app/",
    });

    expect(email.subject).toBe("Welcome to PipeWatch");
    expect(email.text).toContain("Hi Alex,");
    expect(email.text).toContain("https://cloud.pipewatch.app");
    expect(email.html).toContain("Open PipeWatch");
    expect(email.subject).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("uses a generic greeting when name is missing", () => {
    const email = renderWelcomeEmail({
      recipientName: null,
      appUrl: "https://cloud.pipewatch.app",
    });

    expect(email.text.startsWith("Hi,")).toBe(true);
  });
});

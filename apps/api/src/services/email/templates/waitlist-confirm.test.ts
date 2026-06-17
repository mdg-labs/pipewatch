import { describe, expect, it } from "vitest";

import { renderWaitlistConfirmEmail } from "./waitlist-confirm.js";

describe("renderWaitlistConfirmEmail", () => {
  it("renders waitlist confirmation copy with sentence case and no emoji", () => {
    const email = renderWaitlistConfirmEmail({
      confirmUrl: "https://api.pipewatch.app/api/v1/waitlist/confirm/token123",
    });

    expect(email.subject).toBe("Confirm your waitlist subscription");
    expect(email.text).toContain("Thanks for joining the PipeWatch waitlist.");
    expect(email.text).toContain(
      "https://api.pipewatch.app/api/v1/waitlist/confirm/token123",
    );
    expect(email.html).toContain("Confirm subscription");
    expect(email.subject).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { sendEmail } from "./send-email.js";

describe("sendEmail integration", () => {
  it("no-ops when SMTP_HOST is unset", async () => {
    const transport = {
      sendMail: vi.fn(),
    };

    const result = await sendEmail(
      {
        SMTP_HOST: undefined,
        SMTP_PORT: 587,
        SMTP_USER: undefined,
        SMTP_PASS: undefined,
        SMTP_FROM: "noreply@pipewatch.app",
      },
      {
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      },
      transport,
    );

    expect(result).toEqual({ sent: false });
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("sends via SMTP when configured", async () => {
    const transport = nodemailer.createTransport({
      jsonTransport: true,
    });

    const result = await sendEmail(
      {
        SMTP_HOST: "smtp.postmarkapp.com",
        SMTP_PORT: 587,
        SMTP_USER: "token",
        SMTP_PASS: "token",
        SMTP_FROM: "noreply@pipewatch.app",
      },
      {
        to: "user@example.com",
        subject: "Welcome to PipeWatch",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      transport,
    );

    expect(result).toEqual({ sent: true });
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Avatar,
  avatarClassName,
  Badge,
  badgeClassName,
  Button,
  buttonClassName,
  Card,
  cardClassName,
  Input,
  inputWrapClassName,
  RunPulse,
  runPulseDotClassName,
  STATUS_BADGE_CONFIG,
  StatusBadge,
  statusBadgeClassName,
  toInitials,
} from "./index.js";

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), "components");
const stylesPath = join(dirname(fileURLToPath(import.meta.url)), "styles.css");

function readComponentCss(name: string): string {
  return readFileSync(join(componentsDir, name), "utf8");
}

describe("component styles", () => {
  it("imports all component CSS files from styles.css", () => {
    const styles = readFileSync(stylesPath, "utf8");

    expect(styles).toContain("@import './components/button.css'");
    expect(styles).toContain("@import './components/status-badge.css'");
    expect(styles).toContain("@import './components/run-pulse.css'");
  });

  it("uses semantic CSS variables in component stylesheets", () => {
    const cssFiles = [
      "button.css",
      "badge.css",
      "status-badge.css",
      "input.css",
      "card.css",
      "avatar.css",
      "run-pulse.css",
    ];

    for (const file of cssFiles) {
      const css = readComponentCss(file);
      expect(css).toMatch(/var\(--/);
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it("defines amber double-ring focus styles on buttons", () => {
    const buttonCss = readComponentCss("button.css");

    expect(buttonCss).toContain(".pw-btn:focus-visible");
    expect(buttonCss).toContain("var(--bg-base)");
    expect(buttonCss).toContain("var(--focus-ring)");
  });
});

describe("Button", () => {
  it("applies variant and size class names", () => {
    expect(
      buttonClassName({ variant: "danger", size: "lg", iconOnly: true }),
    ).toBe("pw-btn pw-btn-lg pw-btn-danger pw-btn-icon-only");
  });

  it("renders primary variant markup", () => {
    const html = renderToStaticMarkup(
      <Button variant="primary">Save</Button>,
    );

    expect(html).toContain('class="pw-btn pw-btn-md pw-btn-primary"');
    expect(html).toContain("Save");
  });

  it("marks loading buttons as busy for assistive tech", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("pw-btn-spinner");
  });
});

describe("Badge", () => {
  it("applies variant modifiers", () => {
    expect(
      badgeClassName({ variant: "accent", mono: true, pill: true, size: "lg" }),
    ).toBe("pw-badge pw-badge-accent pw-badge-mono pw-badge-pill pw-badge-lg");
  });

  it("renders variant markup", () => {
    const html = renderToStaticMarkup(<Badge variant="success">3</Badge>);

    expect(html).toContain('class="pw-badge pw-badge-success"');
    expect(html).toContain("3");
  });
});

describe("StatusBadge", () => {
  it("covers all six pipeline status labels", () => {
    const statuses = Object.keys(STATUS_BADGE_CONFIG);

    expect(statuses).toEqual([
      "success",
      "failure",
      "running",
      "cancelled",
      "skipped",
      "queued",
    ]);
    expect(STATUS_BADGE_CONFIG.success.label).toBe("Succeeded");
    expect(STATUS_BADGE_CONFIG.running.label).toBe("Running");
  });

  it("renders icon, label, and status semantics for each state", () => {
    for (const status of Object.keys(STATUS_BADGE_CONFIG) as Array<
      keyof typeof STATUS_BADGE_CONFIG
    >) {
      const html = renderToStaticMarkup(<StatusBadge status={status} />);

      expect(html).toContain('role="status"');
      expect(html).toContain(STATUS_BADGE_CONFIG[status].label);
      expect(html).toContain("pw-status");
    }
  });

  it("adds pulse dot class for running state", () => {
    const html = renderToStaticMarkup(
      <StatusBadge status="running" showDot showIcon={false} />,
    );

    expect(html).toContain("pw-status-pulse");
  });

  it("applies large size class name", () => {
    expect(statusBadgeClassName({ size: "lg" })).toBe("pw-status pw-status-lg");
  });
});

describe("Input", () => {
  it("associates labels and error messages for accessibility", () => {
    const html = renderToStaticMarkup(
      <Input label="Repository" error="Required" />,
    );

    expect(html).toContain('class="pw-input-label"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Required");
  });

  it("applies error and mono modifiers", () => {
    expect(
      inputWrapClassName({ error: "Invalid", mono: true, size: "lg" }),
    ).toBe("pw-input-wrap pw-input-error pw-input-mono pw-input-lg");
  });
});

describe("Card", () => {
  it("applies interactive and small size modifiers", () => {
    expect(cardClassName({ size: "sm", interactive: true })).toBe(
      "pw-card pw-card-sm pw-card-interactive",
    );
  });

  it("renders titled card markup", () => {
    const html = renderToStaticMarkup(
      <Card title="Recent runs" subtitle="Last 24 hours">
        Content
      </Card>,
    );

    expect(html).toContain("pw-card-title");
    expect(html).toContain("Recent runs");
    expect(html).toContain("Content");
  });
});

describe("Avatar", () => {
  it("derives initials from a display name", () => {
    expect(toInitials("Jane Doe")).toBe("JD");
    expect(toInitials("")).toBe("?");
  });

  it("renders accessible initials fallback", () => {
    const html = renderToStaticMarkup(<Avatar name="Jane Doe" size="sm" />);

    expect(html).toContain('aria-label="Jane Doe"');
    expect(html).toContain("JD");
    expect(html).toContain("pw-avatar-sm");
  });

  it("applies rounded modifier", () => {
    expect(avatarClassName({ size: "lg", rounded: true })).toBe(
      "pw-avatar pw-avatar-lg pw-avatar-rounded",
    );
  });
});

describe("RunPulse", () => {
  it("renders animated running dot markup", () => {
    const html = renderToStaticMarkup(<RunPulse ring label="Running" />);

    expect(html).toContain("pw-pulse-dot pw-pulse-ring");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Running"');
  });

  it("applies ring modifier class name", () => {
    expect(runPulseDotClassName({ ring: true })).toBe(
      "pw-pulse-dot pw-pulse-ring",
    );
  });
});

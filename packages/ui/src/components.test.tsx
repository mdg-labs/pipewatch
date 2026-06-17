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
  Checkbox,
  checkboxBoxClassName,
  Dialog,
  dialogBoxClassName,
  EmptyState,
  emptyStateClassName,
  Input,
  inputWrapClassName,
  Radio,
  radioWrapClassName,
  RadioGroup,
  radioGroupListClassName,
  RunPulse,
  runPulseDotClassName,
  Select,
  selectClassName,
  Skeleton,
  skeletonClassName,
  STATUS_BADGE_CONFIG,
  StatusBadge,
  statusBadgeClassName,
  Switch,
  switchWrapClassName,
  Tabs,
  Toast,
  toastClassName,
  Tooltip,
  tooltipBoxClassName,
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
    expect(styles).toContain("@import './components/select.css'");
    expect(styles).toContain("@import './components/dialog.css'");
    expect(styles).toContain("@import './components/tabs.css'");
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
      "select.css",
      "checkbox.css",
      "switch.css",
      "radio.css",
      "radio-group.css",
      "skeleton.css",
      "empty-state.css",
      "dialog.css",
      "toast.css",
      "tooltip.css",
      "tabs.css",
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

describe("Select", () => {
  it("renders labelled select markup", () => {
    const html = renderToStaticMarkup(
      <Select label="Retention" options={["7 days", "30 days"]} value="30 days" />,
    );

    expect(html).toContain('class="pw-sel-label"');
    expect(html).toContain('class="pw-sel pw-sel-md"');
    expect(html).toContain("Retention");
  });

  it("applies error and mono modifiers", () => {
    expect(
      selectClassName({ size: "lg", error: "Required", mono: true }),
    ).toBe("pw-sel pw-sel-lg pw-sel-mono pw-sel-err");
  });
});

describe("Checkbox", () => {
  it("renders checked checkbox markup", () => {
    const html = renderToStaticMarkup(
      <Checkbox label="Email alerts" checked hint="On failure only" />,
    );

    expect(html).toContain("pw-cb-on");
    expect(html).toContain("Email alerts");
    expect(html).toContain("On failure only");
  });

  it("applies indeterminate modifier", () => {
    expect(checkboxBoxClassName({ indeterminate: true })).toBe(
      "pw-cb-box pw-cb-ind",
    );
  });
});

describe("Switch", () => {
  it("renders switch with role semantics", () => {
    const html = renderToStaticMarkup(
      <Switch label="Live updates" checked size="lg" />,
    );

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("pw-sw-lg");
  });

  it("applies disabled modifier", () => {
    expect(switchWrapClassName({ size: "sm", disabled: true })).toBe(
      "pw-sw-wrap pw-sw-sm pw-sw-disabled",
    );
  });
});

describe("Radio and RadioGroup", () => {
  it("renders radio option markup", () => {
    const html = renderToStaticMarkup(
      <Radio name="plan" value="pro" label="Pro" checked />,
    );

    expect(html).toContain("pw-radio-on");
    expect(html).toContain('type="radio"');
  });

  it("renders radio group with radiogroup role", () => {
    const html = renderToStaticMarkup(
      <RadioGroup
        label="Plan"
        options={["Free", "Pro"]}
        value="Free"
        inline
      />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("pw-rg-inline");
  });

  it("applies radio class modifiers", () => {
    expect(radioWrapClassName({ disabled: true })).toBe(
      "pw-radio-wrap pw-radio-disabled",
    );
    expect(radioGroupListClassName({ inline: true })).toBe(
      "pw-rg-list pw-rg-inline",
    );
  });
});

describe("Skeleton", () => {
  it("renders hidden loading placeholder", () => {
    const html = renderToStaticMarkup(<Skeleton variant="circle" width={24} height={24} />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pw-skeleton-circle");
  });

  it("applies rounded variant class", () => {
    expect(skeletonClassName({ variant: "rounded" })).toBe(
      "pw-skeleton pw-skeleton-rounded",
    );
  });
});

describe("EmptyState", () => {
  it("renders icon, title, description, and CTA slot", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        icon={<span>icon</span>}
        title="No runs yet"
        description="Runs appear once webhooks are connected."
        actions={<button type="button">Connect GitHub</button>}
      />,
    );

    expect(html).toContain("pw-empty-icon");
    expect(html).toContain("No runs yet");
    expect(html).toContain("Runs appear once webhooks are connected.");
    expect(html).toContain("Connect GitHub");
  });

  it("applies base class name", () => {
    expect(emptyStateClassName({ className: "custom" })).toBe("pw-empty custom");
  });
});

describe("Dialog", () => {
  it("does not render when closed", () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} title="Hidden">
        Body
      </Dialog>,
    );

    expect(html).toBe("");
  });

  it("applies size modifier class", () => {
    expect(dialogBoxClassName({ size: "lg" })).toBe("pw-dlg-box pw-dlg-lg");
  });
});

describe("Toast", () => {
  it("renders all feedback variants", () => {
    for (const variant of ["success", "error", "info", "warning"] as const) {
      const html = renderToStaticMarkup(
        <Toast title="Saved" variant={variant} />,
      );

      expect(html).toContain(`pw-toast-${variant}`);
      expect(html).toContain('role="status"');
    }
  });

  it("applies variant class name helper", () => {
    expect(toastClassName({ variant: "warning" })).toBe(
      "pw-toast pw-toast-warning",
    );
  });
});

describe("Tooltip", () => {
  it("renders trigger children without tooltip by default", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Branch name">
        <button type="button">main</button>
      </Tooltip>,
    );

    expect(html).toContain("pw-tip-wrap");
    expect(html).not.toContain('role="tooltip"');
  });

  it("applies position and mono modifiers", () => {
    expect(tooltipBoxClassName({ position: "bottom", mono: true })).toBe(
      "pw-tip-box pw-tip-bottom pw-tip-mono",
    );
  });
});

describe("Tabs", () => {
  it("renders tablist with selected tab", () => {
    const html = renderToStaticMarkup(
      <Tabs
        tabs={[
          { id: "runs", label: "Runs", count: 3 },
          { id: "repos", label: "Repositories" },
        ]}
        defaultTab="runs"
      >
        Panel
      </Tabs>,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("pw-tab-count");
    expect(html).toContain("Panel");
  });
});

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
  Sparkline,
  buildSparklineGeometry,
  RepoCard,
  repoCardClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableCellClassName,
  tableClassName,
  tableHeadClassName,
  tableRowClassName,
  Logo,
  logoClassName,
  LogoWordmark,
  logoWordmarkClassName,
  TimeSeriesChart,
  timeSeriesChartClassName,
  BarChart,
  barChartClassName,
  buildTimeSeriesGeometry,
  buildBarChartGeometry,
  Pagination,
  paginationClassName,
  DataTable,
  dataTableClassName,
  StatCard,
  statCardClassName,
  FilterBar,
  FilterChip,
  filterBarClassName,
  filterChipClassName,
  DangerZone,
  dangerZoneClassName,
  WizardProgress,
  wizardProgressClassName,
  UsageMeter,
  usageMeterClassName,
  TypedConfirmDialog,
} from "./index.js";

const testPaginationLabels = {
  summary: "Showing 21–40 of 47",
  prev: "Prev",
  next: "Next",
  previousPageAriaLabel: "Previous page",
  nextPageAriaLabel: "Next page",
  pagesAriaLabel: "Pages",
  pageAriaLabel: (page: number) => `Page ${page}`,
};

const testWizardSteps = [
  { id: "workspace", label: "Step 1", title: "Create workspace" },
  { id: "github", label: "Step 2", title: "Connect GitHub" },
  { id: "repos", label: "Step 3", title: "Select repos" },
  { id: "done", label: "Step 4", title: "Done" },
];

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
    expect(styles).toContain("@import './components/repo-card.css'");
    expect(styles).toContain("@import './components/table.css'");
    expect(styles).toContain("@import './components/logo.css'");
    expect(styles).toContain("@import './components/charts.css'");
    expect(styles).toContain("@import './components/pagination.css'");
    expect(styles).toContain("@import './components/data-table.css'");
    expect(styles).toContain("@import './components/stat-card.css'");
    expect(styles).toContain("@import './components/filter-bar.css'");
    expect(styles).toContain("@import './components/danger-zone.css'");
    expect(styles).toContain("@import './components/wizard-progress.css'");
    expect(styles).toContain("@import './components/typed-confirm-dialog.css'");
    expect(styles).toContain("@import './components/usage-meter.css'");
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
      "repo-card.css",
      "table.css",
      "logo.css",
      "charts.css",
      "pagination.css",
      "data-table.css",
      "stat-card.css",
      "filter-bar.css",
      "danger-zone.css",
      "wizard-progress.css",
      "typed-confirm-dialog.css",
      "usage-meter.css",
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

  it("renders prefixed slug field markup", () => {
    const html = renderToStaticMarkup(
      <Input
        label="URL slug"
        value="acme"
        mono
        readOnly
        prefix={<span>/workspaces/</span>}
      />,
    );

    expect(html).toContain('class="pw-input-box pw-input-has-prefix"');
    expect(html).toContain('class="pw-input-prefix"');
    expect(html).toContain("/workspaces/");
    expect(html).toContain('value="acme"');
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

describe("Sparkline", () => {
  it("renders placeholder line for insufficient data", () => {
    const html = renderToStaticMarkup(<Sparkline data={[1]} />);

    expect(html).toContain('stroke-dasharray="3 3"');
  });

  it("renders path geometry for multi-point series", () => {
    const geometry = buildSparklineGeometry({
      data: [2, 4, 3, 6],
      width: 80,
      height: 24,
    });

    const html = renderToStaticMarkup(
      <Sparkline data={[2, 4, 3, 6]} showArea showDot />,
    );

    expect(geometry?.linePath).toBeTruthy();
    expect(html).toContain('d="');
    expect(html).toContain("<circle");
  });
});

describe("RepoCard", () => {
  it("renders repo metadata and embedded sparkline from trend", () => {
    const html = renderToStaticMarkup(
      <RepoCard
        org="mdg-labs"
        name="pipewatch"
        branch="main"
        status="failure"
        lastRunTime="3 min ago"
        duration="2m 14s"
        trend={[1, 2, 4, 3, 5]}
      />,
    );

    expect(html).toContain("pw-repo-card");
    expect(html).toContain("mdg-labs/");
    expect(html).toContain("pipewatch");
    expect(html).toContain("main");
    expect(html).toContain("3 min ago");
    expect(html).toContain("2m 14s");
    expect(html).toContain("Failed");
    expect(html).toContain("<path");
  });

  it("applies repo card class name helper", () => {
    expect(repoCardClassName({ className: "extra" })).toBe(
      "pw-repo-card extra",
    );
  });
});

describe("Table", () => {
  it("renders sortable header and monospace cells", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortDirection="asc">
              Duration
            </TableHead>
            <TableHead>Repository</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow hover interactive>
            <TableCell mono>2m 14s</TableCell>
            <TableCell mono>a4f92c1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(html).toContain("pw-table-wrap");
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain("pw-table-sort-btn");
    expect(html).toContain("pw-table-td-mono");
    expect(html).toContain("pw-table-row-hover");
    expect(html).toContain("2m 14s");
    expect(html).toContain("a4f92c1");
  });

  it("applies table class name helpers", () => {
    expect(tableClassName({ className: "extra" })).toBe("pw-table-wrap extra");
    expect(
      tableRowClassName({ hover: true, interactive: true, className: "row" }),
    ).toBe("pw-table-row pw-table-row-hover pw-table-row-interactive row");
    expect(tableHeadClassName({ sortable: true })).toBe(
      "pw-table-th pw-table-th-sortable",
    );
    expect(tableCellClassName({ mono: true })).toBe(
      "pw-table-td pw-table-td-mono",
    );
  });
});

describe("Logo", () => {
  it("renders mark svg with default size", () => {
    const html = renderToStaticMarkup(<Logo />);

    expect(html).toContain('class="pw-logo"');
    expect(html).toContain('width="32"');
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html).toContain("<circle");
    expect(html).toContain("<path");
  });

  it("applies logo class name helper", () => {
    expect(logoClassName({ className: "extra" })).toBe("pw-logo extra");
  });
});

describe("LogoWordmark", () => {
  it("renders mark and logotype", () => {
    const html = renderToStaticMarkup(<LogoWordmark />);

    expect(html).toContain('class="pw-logo-wordmark"');
    expect(html).toContain('class="pw-logo-wordmark-text"');
    expect(html).toContain('class="pw-logo-wordmark-accent"');
    expect(html).toContain("Pipe");
    expect(html).toContain("Watch");
    expect(html).toContain('aria-label="PipeWatch"');
  });

  it("applies wordmark class name helper", () => {
    expect(logoWordmarkClassName({ className: "extra" })).toBe(
      "pw-logo-wordmark extra",
    );
  });
});

describe("TimeSeriesChart", () => {
  it("renders placeholder for insufficient data", () => {
    const html = renderToStaticMarkup(
      <TimeSeriesChart series={[{ id: "a", label: "CI", data: [1] }]} />,
    );

    expect(html).toContain('stroke-dasharray="3 3"');
  });

  it("renders multi-series chart with semantic colors", () => {
    const geometry = buildTimeSeriesGeometry({
      data: [2, 4, 3, 6],
      width: 528,
      height: 180,
    });

    const html = renderToStaticMarkup(
      <TimeSeriesChart
        series={[
          { id: "ci", label: "CI", data: [2, 4, 3, 6] },
          { id: "deploy", label: "Deploy", data: [1, 2, 2, 3] },
        ]}
        labels={["Mon", "Tue", "Wed", "Thu"]}
        yAxisLabels={["0", "2", "4", "6", "8"]}
      />,
    );

    expect(geometry?.linePath).toBeTruthy();
    expect(html).toContain('stroke="var(--pw-chart-1)"');
    expect(html).toContain('stroke="var(--pw-chart-2)"');
    expect(html).toContain("pw-chart-line-draw");
    expect(timeSeriesChartClassName()).toBe("pw-chart");
  });
});

describe("BarChart", () => {
  it("renders placeholder for empty data", () => {
    const html = renderToStaticMarkup(
      <BarChart data={[]} series={[{ id: "success", label: "Success" }]} />,
    );

    expect(html).toContain('stroke-dasharray="3 3"');
  });

  it("renders stacked bars with semantic colors", () => {
    const geometry = buildBarChartGeometry({
      data: [
        { label: "Mon", values: [8, 2] },
        { label: "Tue", values: [6, 1] },
      ],
      width: 560,
      height: 180,
    });

    const html = renderToStaticMarkup(
      <BarChart
        data={[
          { label: "Mon", values: [8, 2] },
          { label: "Tue", values: [6, 1] },
        ]}
        series={[
          { id: "success", label: "Success" },
          { id: "failure", label: "Failure" },
        ]}
      />,
    );

    expect(geometry?.bars.length).toBe(4);
    expect(html).toContain('fill="var(--pw-chart-1)"');
    expect(html).toContain("pw-chart-bar-grow");
    expect(barChartClassName()).toBe("pw-chart");
  });
});

describe("composite components", () => {
  it("renders pagination controls", () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={2}
        totalItems={47}
        onPageChange={() => undefined}
        labels={testPaginationLabels}
      />,
    );

    expect(html).toContain('class="pw-pagination"');
    expect(html).toContain("Showing 21–40 of 47");
    expect(paginationClassName()).toBe("pw-pagination");
  });

  it("renders data table rows with mono cells", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={[
          { id: "sha", header: "SHA", mono: true, render: () => "a1b2c3d" },
          { id: "duration", header: "Duration", mono: true, align: "right", render: () => "2m 14s" },
        ]}
        rows={[{ id: "1" }]}
        getRowKey={(row) => row.id}
      />,
    );

    expect(html).toContain("pw-table-td-mono");
    expect(html).toContain("a1b2c3d");
    expect(dataTableClassName()).toBe("pw-data-table");
  });

  it("renders stat card with trend slot", () => {
    const html = renderToStaticMarkup(
      <StatCard
        label="Total runs"
        value="1,247"
        trend={<span className="pw-stat-trend-up">↑ 12%</span>}
      />,
    );

    expect(html).toContain("pw-stat-card");
    expect(html).toContain("pw-stat-card-trend");
    expect(statCardClassName()).toBe("pw-stat-card");
  });

  it("renders filter bar chips", () => {
    const html = renderToStaticMarkup(
      <FilterBar>
        <FilterChip label="All" active tone="accent" />
        <FilterChip label="Failing" tone="failure" count={1} />
      </FilterBar>,
    );

    expect(html).toContain("pw-filter-bar");
    expect(html).toContain("pw-filter-chip-active");
    expect(filterBarClassName()).toBe("pw-filter-bar");
    expect(filterChipClassName({ active: true, tone: "failure" })).toContain(
      "pw-filter-chip-failure",
    );
  });

  it("renders danger zone section", () => {
    const html = renderToStaticMarkup(
      <DangerZone title="Danger Zone">
        <div>Delete workspace</div>
      </DangerZone>,
    );

    expect(html).toContain("pw-danger-zone");
    expect(dangerZoneClassName()).toBe("pw-danger-zone");
  });

  it("renders wizard progress steps", () => {
    const html = renderToStaticMarkup(
      <WizardProgress
        steps={testWizardSteps}
        currentStepId="github"
        ariaLabel="Onboarding progress"
      />,
    );

    expect(html).toContain("pw-wizard-progress");
    expect(html).toContain("Connect GitHub");
    expect(wizardProgressClassName()).toBe("pw-wizard-progress");
  });

  it("renders usage meter", () => {
    const html = renderToStaticMarkup(
      <UsageMeter label="Repositories" used={23} limit={50} />,
    );

    expect(html).toContain("pw-usage-meter");
    expect(html).toContain("23 / 50");
    expect(usageMeterClassName({ tone: "warning" })).toBe(
      "pw-usage-meter pw-usage-meter-warning",
    );
  });

  it("does not render typed confirm dialog when closed", () => {
    const html = renderToStaticMarkup(
      <TypedConfirmDialog
        open={false}
        title="Delete repository data"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        expectedPhrase="DELETE"
        closeAriaLabel="Close dialog"
        phraseLabel="Type DELETE to confirm"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toBe("");
  });
});

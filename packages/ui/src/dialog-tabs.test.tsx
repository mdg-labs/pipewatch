/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./components/dialog.js";
import { Tabs } from "./components/tabs.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.body.innerHTML = "";
});

describe("Dialog keyboard interaction", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();

    act(() => {
      root.render(
        <Dialog open title="Delete repository" onClose={onClose} closeAriaLabel="Close dialog">
          <button type="button">Confirm</button>
        </Dialog>,
      );
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders in a portal on document.body", () => {
    act(() => {
      root.render(
        <Dialog open title="Settings" onClose={() => undefined} closeAriaLabel="Close dialog">
          Body
        </Dialog>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("traps focus within the dialog on Tab", () => {
    act(() => {
      root.render(
        <Dialog open title="Invite member" onClose={() => undefined} closeAriaLabel="Close dialog">
          <button type="button" id="first-action">
            Send invite
          </button>
          <button type="button" id="second-action">
            Cancel
          </button>
        </Dialog>,
      );
    });

    const firstAction = document.getElementById("first-action");
    const secondAction = document.getElementById("second-action");
    const closeButton = document.querySelector<HTMLButtonElement>(".pw-dlg-close");

    expect(firstAction).not.toBeNull();
    expect(secondAction).not.toBeNull();
    expect(closeButton).not.toBeNull();

    act(() => {
      secondAction?.focus();
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(closeButton);
  });
});

describe("Tabs keyboard interaction", () => {
  const tabs = [
    { id: "runs", label: "Runs" },
    { id: "repos", label: "Repositories" },
    { id: "settings", label: "Settings", disabled: true },
  ];

  it("moves selection with arrow keys", () => {
    act(() => {
      root.render(<Tabs tabs={tabs} defaultTab="runs" />);
    });

    const tablist = document.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    act(() => {
      tablist?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });

    const reposTab = document.getElementById("pw-tab-repos");
    expect(reposTab?.getAttribute("aria-selected")).toBe("true");
    expect(reposTab?.tabIndex).toBe(0);
  });

  it("jumps to first and last enabled tabs with Home and End", () => {
    act(() => {
      root.render(<Tabs tabs={tabs} defaultTab="repos" />);
    });

    const tablist = document.querySelector('[role="tablist"]');

    act(() => {
      tablist?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
    });

    expect(document.getElementById("pw-tab-runs")?.getAttribute("aria-selected")).toBe(
      "true",
    );

    act(() => {
      tablist?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      );
    });

    expect(document.getElementById("pw-tab-repos")?.getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});

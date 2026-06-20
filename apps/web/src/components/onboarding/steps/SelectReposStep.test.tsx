/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RepositorySummary, Workspace } from "@pipewatch/types";

import { SelectReposStep } from "./SelectReposStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

const workspace: Workspace = {
  id: WORKSPACE_ID,
  name: "MDG Labs",
  slug: "mdg-labs",
  plan: "free",
  default_retention_days: 30,
  created_at: "2026-01-01T00:00:00.000Z",
};

const repos: RepositorySummary[] = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    workspace_id: WORKSPACE_ID,
    integration_id: "11111111-1111-4111-8111-111111111111",
    external_repo_id: "1",
    full_name: "mdg-labs/alpha",
    private: false,
    enabled: true,
    polling_interval_seconds: null,
    retention_days: null,
    last_synced_at: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    workspace_id: WORKSPACE_ID,
    integration_id: "11111111-1111-4111-8111-111111111111",
    external_repo_id: "2",
    full_name: "mdg-labs/beta",
    private: false,
    enabled: true,
    polling_interval_seconds: null,
    retention_days: null,
    last_synced_at: null,
  },
];

const mockGet = vi.fn();
const mockWorkspaceClient = {
  get: mockGet,
  patch: vi.fn(),
};

const mockUseApi = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("@/providers/ToastProvider", () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function findButtonByText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === text,
    ) ?? null
  );
}

function selectedCheckboxCount(): number {
  return Array.from(
    document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ).filter((input) => input.checked).length;
}

async function renderStep() {
  await act(async () => {
    root.render(
      <SelectReposStep
        workspace={workspace}
        onBack={() => undefined}
        onComplete={() => undefined}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

let container: HTMLDivElement;
let root: Root;

describe("SelectReposStep", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue(repos);
    mockUseApi.mockReturnValue({
      api: {
        workspace: () => mockWorkspaceClient,
      },
    });

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

  it("select all then deselect all clears selection and disables Start syncing", async () => {
    await renderStep();

    const selectAllButton = findButtonByText("Select all");
    const deselectAllButton = findButtonByText("Deselect all");
    const startSyncButton = findButtonByText("Start syncing");

    expect(selectAllButton).not.toBeNull();
    expect(deselectAllButton).not.toBeNull();
    expect(startSyncButton).not.toBeNull();
    expect(selectedCheckboxCount()).toBe(2);

    const firstCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(firstCheckbox).not.toBeNull();

    await act(async () => {
      firstCheckbox!.click();
      await Promise.resolve();
    });

    expect(selectedCheckboxCount()).toBe(1);
    expect(selectAllButton!.disabled).toBe(false);

    await act(async () => {
      selectAllButton!.click();
      await Promise.resolve();
    });

    expect(selectedCheckboxCount()).toBe(2);

    await act(async () => {
      deselectAllButton!.click();
      await Promise.resolve();
    });

    expect(selectedCheckboxCount()).toBe(0);
    expect(startSyncButton!.disabled).toBe(true);
    expect(deselectAllButton!.disabled).toBe(true);
  });
});

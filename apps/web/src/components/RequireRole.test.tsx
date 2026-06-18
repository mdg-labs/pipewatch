import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { RequireRole } from "./RequireRole";
import { ReadOnlyNotice } from "./ReadOnlyNotice";

const mockUseApi = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useApi: () => mockUseApi(),
}));

function renderRoleTree(
  minimumRole: "admin" | "owner",
  child: ReactNode = <p>Protected content</p>,
) {
  return renderToStaticMarkup(
    <RequireRole minimumRole={minimumRole}>{child}</RequireRole>,
  );
}

describe("RequireRole", () => {
  beforeEach(() => {
    mockUseApi.mockReset();
  });

  it("renders children for admin on admin-gated pages", () => {
    mockUseApi.mockReturnValue({
      claims: { role: "admin" },
      workspaces: [],
      workspaceSlug: "mdg-labs",
    });

    const html = renderRoleTree("admin");
    expect(html).toContain("Protected content");
    expect(html).not.toContain("Insufficient permissions");
  });

  it("renders children read-only for members on admin-gated pages", () => {
    mockUseApi.mockReturnValue({
      claims: { role: "member" },
      workspaces: [],
      workspaceSlug: "mdg-labs",
    });

    const html = renderToStaticMarkup(
      <RequireRole minimumRole="admin">
        <ReadOnlyNotice />
        <p>Settings form</p>
      </RequireRole>,
    );

    expect(html).toContain("Settings form");
    expect(html).toContain("read-only access");
    expect(html).not.toContain("Insufficient permissions");
  });

  it("blocks non-owners on owner-gated pages", () => {
    mockUseApi.mockReturnValue({
      claims: { role: "admin" },
      workspaces: [],
      workspaceSlug: "mdg-labs",
    });

    const html = renderRoleTree("owner");
    expect(html).not.toContain("Protected content");
    expect(html).toContain("Insufficient permissions");
  });

  it("renders children for owners on owner-gated pages", () => {
    mockUseApi.mockReturnValue({
      claims: { role: "owner" },
      workspaces: [],
      workspaceSlug: "mdg-labs",
    });

    const html = renderRoleTree("owner");
    expect(html).toContain("Protected content");
    expect(html).not.toContain("Insufficient permissions");
  });

  it("falls back when role is unknown", () => {
    mockUseApi.mockReturnValue({
      claims: null,
      workspaces: [],
      workspaceSlug: "mdg-labs",
    });

    const html = renderRoleTree("admin");
    expect(html).not.toContain("Protected content");
    expect(html).toContain("Insufficient permissions");
  });
});

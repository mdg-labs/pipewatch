import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage.js";

vi.mock("../hooks/use-auth.js", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("LoginPage", () => {
  it("renders the PipeWatch logo above the sign-in form", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(html).toContain('class="pw-logo-wordmark"');
    expect(html).toContain("Forgot password?");
    expect(html).toContain("/forgot-password");
  });
});

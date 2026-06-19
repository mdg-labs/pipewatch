import { describe, expect, it } from "vitest";

import {
  ACCESS_COOKIE_SAME_SITE,
  REFRESH_COOKIE_SAME_SITE,
} from "./shared.js";

describe("auth cookie SameSite policy", () => {
  it("uses Lax for access cookie so OAuth redirect chain attaches session on app host", () => {
    expect(ACCESS_COOKIE_SAME_SITE).toBe("Lax");
  });

  it("keeps Strict for refresh cookie per PRD §20", () => {
    expect(REFRESH_COOKIE_SAME_SITE).toBe("Strict");
  });
});

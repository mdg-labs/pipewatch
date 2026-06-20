import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultLocale } from "./config";
import en from "./locales/en.json";
import { missingMessageFallback, warnMissingMessage } from "./missing-message";

describe("i18n", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolves catalog strings via createTranslator", () => {
    const t = createTranslator({
      locale: defaultLocale,
      messages: en,
      namespace: "common.error",
    });

    expect(t("title")).toBe("Something went wrong");
    expect(t("retry")).toBe("Retry");
  });

  it("warns in development when a message key is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "development");

    warnMissingMessage({
      code: "MISSING_MESSAGE",
      originalMessage: "common.error.missing",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[i18n] Missing message: common.error.missing",
    );
  });

  it("returns a namespaced fallback for missing keys", () => {
    expect(
      missingMessageFallback({
        error: {
          code: "MISSING_MESSAGE",
          originalMessage: "common.error.missing",
        },
        namespace: "common.error",
        key: "missing",
      }),
    ).toBe("common.error.missing");
  });
});

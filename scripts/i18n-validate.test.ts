import { describe, expect, it } from "vitest";

import {
  compareLocaleKeySets,
  flattenMessageKeys,
  formatI18nValidateIssues,
  leafStringValues,
  parseSupportedLocales,
  validateI18nCatalog,
} from "./i18n-validate.ts";

describe("flattenMessageKeys", () => {
  it("flattens nested locale objects", () => {
    expect(
      [...flattenMessageKeys({ app: { title: "PipeWatch" }, common: { ok: "OK" } })],
    ).toEqual(["app.title", "common.ok"]);
  });
});

describe("leafStringValues", () => {
  it("collects only string leaves", () => {
    const values = leafStringValues({
      app: { title: "PipeWatch", count: 1 },
      common: { ok: "OK" },
    });

    expect([...values.entries()]).toEqual([
      ["app.title", "PipeWatch"],
      ["common.ok", "OK"],
    ]);
  });
});

describe("parseSupportedLocales", () => {
  it("parses supported locale config", () => {
    expect(
      parseSupportedLocales(
        JSON.stringify({
          defaultLocale: "en",
          fallbackLocale: "en",
          locales: ["en"],
        }),
      ),
    ).toEqual({
      defaultLocale: "en",
      fallbackLocale: "en",
      locales: ["en"],
    });
  });
});

describe("compareLocaleKeySets", () => {
  it("reports missing and extra keys", () => {
    const canonical = new Set(["a", "b"]);
    const locale = new Set(["a", "c"]);
    const issues = compareLocaleKeySets(canonical, "de", locale);

    expect(issues).toEqual([
      { code: "missing-key", message: 'locale "de" missing key "b"' },
      { code: "extra-key", message: 'locale "de" has extra key "c"' },
    ]);
  });
});

describe("validateI18nCatalog", () => {
  it("passes for matching single-locale catalogs", () => {
    const issues = validateI18nCatalog({
      existsFile: () => true,
      readFile: (path) => {
        if (path.endsWith("supported-locales.json")) {
          return JSON.stringify({
            defaultLocale: "en",
            fallbackLocale: "en",
            locales: ["en"],
          });
        }

        return JSON.stringify({
          app: { title: "PipeWatch" },
        });
      },
    });

    expect(issues).toEqual([]);
  });

  it("flags key parity drift between locales", () => {
    const issues = validateI18nCatalog({
      existsFile: () => true,
      readFile: (path) => {
        if (path.endsWith("supported-locales.json")) {
          return JSON.stringify({
            defaultLocale: "en",
            fallbackLocale: "en",
            locales: ["en", "de"],
          });
        }

        if (path.endsWith("en.json")) {
          return JSON.stringify({ app: { title: "PipeWatch" } });
        }

        return JSON.stringify({ app: { title: "PipeWatch", extra: "x" } });
      },
    });

    expect(issues.some((issue) => issue.code === "extra-key")).toBe(true);
  });

  it("flags empty leaf values", () => {
    const issues = validateI18nCatalog({
      existsFile: () => true,
      readFile: (path) => {
        if (path.endsWith("supported-locales.json")) {
          return JSON.stringify({
            defaultLocale: "en",
            fallbackLocale: "en",
            locales: ["en"],
          });
        }

        return JSON.stringify({ app: { title: "" } });
      },
    });

    expect(issues).toEqual([
      {
        code: "empty-value",
        message: 'locale "en" has empty value for key "app.title"',
      },
    ]);
  });
});

describe("formatI18nValidateIssues", () => {
  it("formats issue list", () => {
    expect(
      formatI18nValidateIssues([
        { code: "missing-key", message: 'locale "de" missing key "app.title"' },
      ]),
    ).toBe('- [missing-key] locale "de" missing key "app.title"');
  });
});

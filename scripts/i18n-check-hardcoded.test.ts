import { describe, expect, it } from "vitest";

import {
  checkHardcodedStringsInFile,
  findHardcodedStringLiterals,
  formatI18nHardcodedIssues,
  isAllowlistedHardcodedFile,
  looksLikeUserFacingEnglish,
} from "./i18n-check-hardcoded.ts";

describe("looksLikeUserFacingEnglish", () => {
  it("detects title-case UI copy", () => {
    expect(looksLikeUserFacingEnglish("Save changes")).toBe(true);
  });

  it("ignores technical literals", () => {
    expect(looksLikeUserFacingEnglish("pw-button")).toBe(false);
    expect(looksLikeUserFacingEnglish("Escape")).toBe(false);
    expect(looksLikeUserFacingEnglish("sm")).toBe(false);
  });
});

describe("findHardcodedStringLiterals", () => {
  it("flags inline English in JSX attributes", () => {
    const source = `
      export function Example() {
        return <button aria-label="Save workspace">Save</button>;
      }
    `;

    const findings = findHardcodedStringLiterals(source, "example.tsx");
    expect(findings.map((finding) => finding.text)).toEqual([
      "Save workspace",
      "Save",
    ]);
  });

  it("ignores class names and keyboard keys", () => {
    const source = `
      export function Example() {
        if (event.key === "Escape") {
          return <div className="pw-card">{"dynamic"}</div>;
        }
        return null;
      }
    `;

    expect(findHardcodedStringLiterals(source, "example.tsx")).toEqual([]);
  });
});

describe("checkHardcodedStringsInFile", () => {
  it("skips allowlisted files", () => {
    expect(
      isAllowlistedHardcodedFile("packages/ui/src/components/status-badge.tsx"),
    ).toBe(true);

    const issues = checkHardcodedStringsInFile({
      repoRoot: "/repo",
      relativePath: "packages/ui/src/components/status-badge.tsx",
      readFile: () => 'const label = "Succeeded";',
    });

    expect(issues).toEqual([]);
  });

  it("skips test tsx files", () => {
    const issues = checkHardcodedStringsInFile({
      repoRoot: "/repo",
      relativePath: "packages/ui/src/components/button.test.tsx",
      readFile: () => '<button>Save</button>',
    });

    expect(issues).toEqual([]);
  });

  it("reports violations in non-allowlisted files", () => {
    const issues = checkHardcodedStringsInFile({
      repoRoot: "/repo",
      relativePath: "packages/ui/src/components/button.tsx",
      readFile: () => 'export const label = "Save now";',
      allowlist: [],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.finding.text).toBe("Save now");
  });
});

describe("checkHardcodedStrings", () => {
  it("formats findings", () => {
    expect(
      formatI18nHardcodedIssues([
        {
          code: "hardcoded-english",
          message: 'packages/ui/src/foo.tsx:1:1 hardcoded English (literal): "Save"',
          finding: {
            file: "packages/ui/src/foo.tsx",
            line: 1,
            column: 1,
            text: "Save",
            kind: "literal",
          },
        },
      ]),
    ).toContain("hardcoded English");
  });

  it("passes clean prop-driven component source", () => {
    const issues = checkHardcodedStringsInFile({
      repoRoot: "/repo",
      relativePath: "packages/ui/src/components/clean.tsx",
      allowlist: [],
      readFile: () => `
        export function Clean({ title }: { title: string }) {
          return <div aria-label={title}>{title}</div>;
        }
      `,
    });

    expect(issues).toEqual([]);
  });
});

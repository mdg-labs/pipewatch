import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const tokensDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(tokensDir, "..");

function readTokenFile(name: string): string {
  return readFileSync(join(tokensDir, name), "utf8");
}

function readStylesEntry(): string {
  return readFileSync(join(srcDir, "styles.css"), "utf8");
}

function extractCssVariables(css: string): Set<string> {
  const matches = css.matchAll(/--[\w-]+/g);
  return new Set([...matches].map((match) => match[0]));
}

describe("design token CSS files", () => {
  it("exports a single styles.css entry that imports all token files", () => {
    const styles = readStylesEntry();

    expect(styles).toContain("@import './tokens/fonts.css'");
    expect(styles).toContain("@import './tokens/colors.css'");
    expect(styles).toContain("@import './tokens/semantic.css'");
    expect(styles).toContain("@import './tokens/typography.css'");
    expect(styles).toContain("@import './tokens/spacing.css'");
    expect(styles).toContain("@import './tokens/shadows.css'");
    expect(styles).toContain("@import './tokens/motion.css'");
  });

  it("uses self-hosted @font-face rules without Google Fonts CDN", () => {
    const fonts = readTokenFile("fonts.css");

    expect(fonts).toContain("@font-face");
    expect(fonts).toContain("font-family: 'Hanken Grotesk'");
    expect(fonts).toContain("font-family: 'JetBrains Mono'");
    expect(fonts).not.toContain("fonts.googleapis.com");
    expect(fonts).not.toContain("@import url(");
  });

  it("defines dark-default semantic tokens and light theme overrides", () => {
    const semantic = readTokenFile("semantic.css");
    const variables = extractCssVariables(semantic);

    expect(variables.has("--bg-base")).toBe(true);
    expect(variables.has("--text-primary")).toBe(true);
    expect(variables.has("--status-running")).toBe(true);
    expect(semantic).toContain(':root {');
    expect(semantic).toContain('[data-theme="light"]');
    expect(semantic).toMatch(/:root[\s\S]*--bg-base:\s*var\(--pw-slate-950\)/);
    expect(semantic).toMatch(
      /\[data-theme="light"\][\s\S]*--bg-base:\s*var\(--pw-slate-50\)/,
    );
  });

  it("defines primitive color, spacing, shadow, motion, and typography tokens", () => {
    const colors = extractCssVariables(readTokenFile("colors.css"));
    const spacing = extractCssVariables(readTokenFile("spacing.css"));
    const shadows = extractCssVariables(readTokenFile("shadows.css"));
    const motion = extractCssVariables(readTokenFile("motion.css"));
    const typography = extractCssVariables(readTokenFile("typography.css"));

    expect(colors.has("--pw-amber-500")).toBe(true);
    expect(colors.has("--pw-chart-1")).toBe(true);
    expect(spacing.has("--space-4")).toBe(true);
    expect(spacing.has("--radius-lg")).toBe(true);
    expect(shadows.has("--shadow-lg")).toBe(true);
    expect(motion.has("--duration-normal")).toBe(true);
    expect(typography.has("--font-sans")).toBe(true);
    expect(typography.has("--text-base")).toBe(true);
  });

  it("includes a visual smoke page for token swatches", () => {
    const smokePage = readFileSync(
      join(srcDir, "smoke", "token-swatch.html"),
      "utf8",
    );

    expect(smokePage).toContain('href="../styles.css"');
    expect(smokePage).toContain("status-colors");
    expect(smokePage).toContain('setAttribute("data-theme", "light")');
  });
});

/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Input } from "./components/input.js";

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), "components");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const style = document.createElement("style");
  style.setAttribute("data-test", "input-css");
  style.textContent = readFileSync(join(componentsDir, "input.css"), "utf8");
  document.head.appendChild(style);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.querySelector('style[data-test="input-css"]')?.remove();
  document.body.innerHTML = "";
});

describe("Input prefix layout", () => {
  it("renders /workspaces/ prefix before the field without overlap", () => {
    act(() => {
      root.render(
        <Input
          label="URL slug"
          value="acme-engineering"
          mono
          prefix={<span>/workspaces/</span>}
          readOnly
        />,
      );
    });

    const prefix = container.querySelector(".pw-input-prefix");
    const field = container.querySelector<HTMLInputElement>(".pw-input-field");
    const box = container.querySelector(".pw-input-box");

    expect(box?.classList.contains("pw-input-has-prefix")).toBe(true);
    expect(prefix?.textContent).toBe("/workspaces/");
    expect(field?.value).toBe("acme-engineering");

    const prefixRect = prefix?.getBoundingClientRect();
    const fieldRect = field?.getBoundingClientRect();

    expect(prefixRect).toBeDefined();
    expect(fieldRect).toBeDefined();
    expect(prefixRect!.right).toBeLessThanOrEqual(fieldRect!.left + 1);
  });

  it("uses flex adornment layout in input.css", () => {
    const css = readFileSync(join(componentsDir, "input.css"), "utf8");

    expect(css).toContain(".pw-input-has-prefix,");
    expect(css).toContain("display: flex;");
    expect(css).not.toContain("position: absolute;");
  });
});

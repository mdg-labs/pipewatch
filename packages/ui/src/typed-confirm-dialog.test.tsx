/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfirmDialog } from "./components/typed-confirm-dialog.js";

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

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("TypedConfirmDialog", () => {
  it("keeps confirm disabled until the phrase matches", () => {
    const onConfirm = vi.fn();

    act(() => {
      root.render(
        <TypedConfirmDialog
          open
          title="Delete repository data"
          description="This cannot be undone."
          confirmLabel="Delete repository data"
          cancelLabel="Cancel"
          expectedPhrase="inboxops"
          closeAriaLabel="Close dialog"
          phraseLabel="Type inboxops to confirm"
          onClose={() => undefined}
          onConfirm={onConfirm}
        />,
      );
    });

    const confirmButton = document.body.querySelector(
      ".pw-btn-danger",
    ) as HTMLButtonElement | null;
    const input = document.body.querySelector(
      ".pw-input-field",
    ) as HTMLInputElement | null;

    expect(confirmButton).not.toBeNull();
    expect(input).not.toBeNull();
    expect(confirmButton?.disabled).toBe(true);

    act(() => {
      setInputValue(input!, "inboxop");
    });

    expect(confirmButton?.disabled).toBe(true);

    act(() => {
      setInputValue(input!, "inboxops");
    });

    expect(confirmButton?.disabled).toBe(false);

    act(() => {
      confirmButton?.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

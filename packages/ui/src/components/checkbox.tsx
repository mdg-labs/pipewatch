import type { InputHTMLAttributes } from "react";
import { useEffect, useId, useRef } from "react";

import { classNames } from "../lib/class-names.js";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  hint?: string;
}

function slugifyLabel(label: string): string {
  return label.replace(/\s+/g, "-").toLowerCase();
}

export function checkboxWrapClassName({
  disabled = false,
  className,
}: {
  disabled?: boolean;
  className?: string | undefined;
}): string {
  return classNames("pw-cb-wrap", disabled && "pw-cb-disabled", className);
}

export function checkboxBoxClassName({
  checked = false,
  indeterminate = false,
}: {
  checked?: boolean;
  indeterminate?: boolean;
}): string {
  return classNames(
    "pw-cb-box",
    checked && "pw-cb-on",
    indeterminate && "pw-cb-ind",
  );
}

export function Checkbox({
  label,
  checked = false,
  onChange,
  disabled = false,
  indeterminate = false,
  hint,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const inputId =
    id ?? (label ? `pw-cb-${slugifyLabel(label)}` : generatedId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label
      className={checkboxWrapClassName({ disabled, className })}
      htmlFor={inputId}
    >
      <div className={checkboxBoxClassName({ checked, indeterminate })}>
        <input
          ref={inputRef}
          type="checkbox"
          id={inputId}
          className="pw-cb-input"
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          disabled={disabled}
          {...rest}
        />
        {checked && !indeterminate ? (
          <svg
            className="pw-cb-mark"
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="2 6 5 9 10 3" />
          </svg>
        ) : null}
        {indeterminate ? (
          <svg
            className="pw-cb-mark"
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
          >
            <line x1="2.5" y1="6" x2="9.5" y2="6" />
          </svg>
        ) : null}
      </div>
      {label || hint ? (
        <div className="pw-cb-labels">
          {label ? <span className="pw-cb-label">{label}</span> : null}
          {hint ? <span className="pw-cb-hint">{hint}</span> : null}
        </div>
      ) : null}
    </label>
  );
}

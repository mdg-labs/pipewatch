import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { classNames } from "../lib/class-names.js";

export type SwitchSize = "sm" | "md" | "lg";

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "size"> {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: SwitchSize;
  hint?: string;
}

function slugifyLabel(label: string): string {
  return label.replace(/\s+/g, "-").toLowerCase();
}

export function switchWrapClassName({
  size = "md",
  disabled = false,
  className,
}: {
  size?: SwitchSize;
  disabled?: boolean;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-sw-wrap",
    `pw-sw-${size}`,
    disabled && "pw-sw-disabled",
    className,
  );
}

export function Switch({
  label,
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  hint,
  id,
  className,
  ...rest
}: SwitchProps) {
  const generatedId = useId();
  const inputId =
    id ?? (label ? `pw-sw-${slugifyLabel(label)}` : generatedId);

  return (
    <label className={switchWrapClassName({ size, disabled, className })} htmlFor={inputId}>
      <div className={classNames("pw-sw-track", checked && "pw-sw-on")}>
        <input
          type="checkbox"
          id={inputId}
          className="pw-sw-input"
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          disabled={disabled}
          role="switch"
          aria-checked={checked}
          {...rest}
        />
        <div className="pw-sw-thumb" />
      </div>
      {label || hint ? (
        <div className="pw-sw-labels">
          {label ? <span className="pw-sw-label">{label}</span> : null}
          {hint ? <span className="pw-sw-hint">{hint}</span> : null}
        </div>
      ) : null}
    </label>
  );
}

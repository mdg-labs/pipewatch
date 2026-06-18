import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { classNames } from "../lib/class-names.js";

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  label?: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  hint?: string;
  value: string;
}

export function radioWrapClassName({
  disabled = false,
  className,
}: {
  disabled?: boolean;
  className?: string | undefined;
}): string {
  return classNames("pw-radio-wrap", disabled && "pw-radio-disabled", className);
}

export function Radio({
  label,
  checked = false,
  onChange,
  disabled = false,
  name,
  value,
  hint,
  id,
  className,
  ...rest
}: RadioProps) {
  const generatedId = useId();
  const inputId = id ?? `pw-radio-${name ?? "group"}-${value}-${generatedId}`;

  return (
    <label className={radioWrapClassName({ disabled, className })} htmlFor={inputId}>
      <div className={classNames("pw-radio-circle", checked && "pw-radio-on")}>
        <input
          type="radio"
          id={inputId}
          className="pw-radio-input"
          checked={checked}
          onChange={(event) => {
            if (event.target.checked) {
              onChange?.(value);
            }
          }}
          disabled={disabled}
          name={name}
          value={value}
          {...rest}
        />
      </div>
      {label || hint ? (
        <div>
          {label ? <div className="pw-radio-label">{label}</div> : null}
          {hint ? <div className="pw-radio-hint">{hint}</div> : null}
        </div>
      ) : null}
    </label>
  );
}

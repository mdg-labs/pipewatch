import type { ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

import { Radio } from "./radio.js";

export type RadioGroupOption =
  | string
  | {
      value: string;
      label: string;
      hint?: string;
      disabled?: boolean;
    };

export interface RadioGroupProps {
  label?: string;
  options?: RadioGroupOption[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  inline?: boolean;
  hint?: string;
  className?: string;
}

export function radioGroupListClassName({
  inline = false,
}: {
  inline?: boolean;
}): string {
  return classNames("pw-rg-list", inline && "pw-rg-inline");
}

export function RadioGroup({
  label,
  options = [],
  value,
  onChange,
  name = "rg",
  disabled = false,
  inline = false,
  hint,
  className,
}: RadioGroupProps) {
  return (
    <div className={classNames("pw-rg-wrap", className)}>
      {label ? <div className="pw-rg-label">{label}</div> : null}
      <div className={radioGroupListClassName({ inline })} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          const optionHint = typeof option === "object" ? option.hint : undefined;
          const optionDisabled =
            typeof option === "object" ? option.disabled : false;

          return (
            <Radio
              key={optionValue}
              name={name}
              value={optionValue}
              label={optionLabel}
              checked={value === optionValue}
              disabled={disabled || Boolean(optionDisabled)}
              {...(optionHint !== undefined ? { hint: optionHint } : {})}
              {...(onChange !== undefined ? { onChange } : {})}
            />
          );
        })}
      </div>
      {hint ? <div className="pw-rg-hint">{hint}</div> : null}
    </div>
  );
}

export type { ReactNode };

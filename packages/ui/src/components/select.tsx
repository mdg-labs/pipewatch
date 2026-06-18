import type { SelectHTMLAttributes } from "react";
import { useId } from "react";

import { ChevronDown } from "lucide-react";

import { classNames } from "../lib/class-names.js";

export type SelectSize = "sm" | "md" | "lg";

export type SelectOption =
  | string
  | {
      value: string;
      label: string;
      disabled?: boolean;
    };

export interface SelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "size" | "onChange" | "value"
  > {
  label?: string;
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: SelectSize;
  error?: string;
  hint?: string;
  mono?: boolean;
}

export function selectClassName({
  size = "md",
  error,
  mono = false,
  className,
}: {
  size?: SelectSize;
  error?: string | undefined;
  mono?: boolean;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-sel",
    `pw-sel-${size}`,
    mono && "pw-sel-mono",
    error && "pw-sel-err",
    className,
  );
}

function slugifyLabel(label: string): string {
  return label.replace(/\s+/g, "-").toLowerCase();
}

export function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder,
  size = "md",
  error,
  hint,
  disabled = false,
  mono = false,
  id,
  className,
  style,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const inputId = id ?? (label ? `pw-sel-${slugifyLabel(label)}` : generatedId);
  const hasError = Boolean(error);

  return (
    <div className={classNames("pw-sel-wrap", className)} style={style}>
      {label ? (
        <label htmlFor={inputId} className="pw-sel-label">
          {label}
        </label>
      ) : null}
      <div className="pw-sel-rel">
        <select
          id={inputId}
          className={selectClassName({ size, error, mono })}
          value={value ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => {
            const optionValue = typeof option === "string" ? option : option.value;
            const optionLabel = typeof option === "string" ? option : option.label;
            const optionDisabled =
              typeof option === "object" ? option.disabled : false;

            return (
              <option
                key={optionValue}
                value={optionValue}
                disabled={optionDisabled}
              >
                {optionLabel}
              </option>
            );
          })}
        </select>
        <span className="pw-sel-chevron" aria-hidden>
          <ChevronDown size={12} strokeWidth={2} />
        </span>
      </div>
      {hasError ? (
        <span id={`${inputId}-error`} className="pw-sel-errmsg" role="alert">
          {error}
        </span>
      ) : null}
      {hint && !hasError ? (
        <span id={`${inputId}-hint`} className="pw-sel-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

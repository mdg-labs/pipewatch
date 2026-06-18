import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import { classNames } from "../lib/class-names.js";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: "lg";
}

export function inputWrapClassName({
  error,
  mono = false,
  size,
  className,
}: {
  error?: string | undefined;
  mono?: boolean;
  size?: "lg" | undefined;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-input-wrap",
    error && "pw-input-error",
    mono && "pw-input-mono",
    size === "lg" && "pw-input-lg",
    className,
  );
}

export function Input({
  label,
  id,
  error,
  hint,
  mono = false,
  prefix,
  suffix,
  size,
  className,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hasError = Boolean(error);

  return (
    <div className={inputWrapClassName({ error, mono, size, className })}>
      {label ? (
        <label htmlFor={fieldId} className="pw-input-label">
          {label}
        </label>
      ) : null}
      <div
        className={classNames(
          "pw-input-box",
          Boolean(prefix) && "pw-input-has-prefix",
          Boolean(suffix) && "pw-input-has-suffix",
        )}
      >
        {prefix ? <span className="pw-input-prefix">{prefix}</span> : null}
        <input
          id={fieldId}
          className="pw-input-field"
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          {...rest}
        />
        {suffix ? <span className="pw-input-suffix">{suffix}</span> : null}
      </div>
      {hasError ? (
        <span id={`${fieldId}-error`} className="pw-input-error-msg" role="alert">
          {error}
        </span>
      ) : null}
      {hint && !hasError ? (
        <span id={`${fieldId}-hint`} className="pw-input-help">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

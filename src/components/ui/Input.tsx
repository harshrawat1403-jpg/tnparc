import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = "", ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    const describedBy =
      [errorId, helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            {label}
            {props.required && (
              <span
                className="text-[var(--color-danger)] ml-0.5"
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`w-full px-3 py-2 text-sm bg-[var(--color-surface)] text-[var(--color-text-primary)] border rounded-[var(--radius-md)] placeholder:text-[var(--color-text-disabled)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)] disabled:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed ${
            error
              ? "border-[var(--color-danger)] focus-visible:outline-[var(--color-danger)]"
              : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
          } ${className}`.trim()}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="text-xs text-[var(--color-danger)] font-medium mt-0.5"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={helperId}
            className="text-xs text-[var(--color-text-secondary)] mt-0.5"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

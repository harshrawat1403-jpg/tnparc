import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { children, variant = "default", padding = "md", className = "", ...props },
    ref
  ) => {
    const baseStyles = "rounded-[var(--radius-lg)] transition-all";

    const variantStyles = {
      default:
        "bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]",
      subtle:
        "bg-[var(--color-surface-alt)] border border-[var(--color-border)]",
      interactive:
        "bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] cursor-pointer",
    };

    const paddingStyles = {
      none: "p-0",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

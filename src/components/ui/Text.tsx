import React from "react";

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "body" | "secondary" | "small" | "lead";
  as?: "p" | "span" | "div";
}

export const Text: React.FC<TextProps> = ({
  variant = "body",
  as: Component = "p",
  children,
  className = "",
  ...props
}) => {
  const variantStyles = {
    lead: "text-lg text-[var(--color-text-secondary)] leading-relaxed",
    body: "text-base text-[var(--color-text-primary)] leading-normal",
    secondary: "text-sm text-[var(--color-text-secondary)] leading-normal",
    small: "text-xs text-[var(--color-text-secondary)] leading-normal",
  };

  return (
    <Component
      className={`${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
};

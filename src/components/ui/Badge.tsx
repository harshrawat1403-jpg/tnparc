import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center font-medium rounded-[var(--radius-sm)] border leading-none";

  const variantStyles = {
    default:
      "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
    success: "bg-[#EBF7EE] text-[var(--color-success)] border-[#B7E4C7]",
    warning: "bg-[#FEF3C7] text-[var(--color-warning)] border-[#FDE68A]",
    danger: "bg-[#FEE2E2] text-[var(--color-danger)] border-[#FECACA]",
    info: "bg-[#EFF6FF] text-[var(--color-info)] border-[#BFDBFE]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
};

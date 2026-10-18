import React from "react";

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  spacing?: "sm" | "md" | "lg";
}

export const Divider: React.FC<DividerProps> = ({
  spacing = "md",
  className = "",
  ...props
}) => {
  const spacingStyles = {
    sm: "my-3",
    md: "my-6",
    lg: "my-10",
  };

  return (
    <hr
      className={`w-full border-0 border-t border-[var(--color-border)] ${spacingStyles[spacing]} ${className}`.trim()}
      {...props}
    />
  );
};

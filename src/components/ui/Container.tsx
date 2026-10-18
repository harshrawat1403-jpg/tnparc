import React from "react";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  as?: React.ElementType;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = "lg",
  as: Component = "div",
  className = "",
  ...props
}) => {
  const sizeStyles = {
    sm: "max-w-3xl",
    md: "max-w-5xl",
    lg: "max-w-7xl",
    xl: "max-w-[1400px]",
    full: "max-w-full",
  };

  return (
    <Component
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${sizeStyles[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
};

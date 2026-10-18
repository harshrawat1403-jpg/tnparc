import React from "react";

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const Heading: React.FC<HeadingProps> = ({
  level = 1,
  as,
  children,
  className = "",
  ...props
}) => {
  const Tag = as || (`h${level}` as const);

  const levelStyles = {
    1: "text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-text-primary)] leading-tight",
    2: "text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-snug",
    3: "text-xl sm:text-2xl font-semibold text-[var(--color-text-primary)] leading-snug",
    4: "text-lg sm:text-xl font-medium text-[var(--color-text-primary)] leading-normal",
  };

  return (
    <Tag className={`${levelStyles[level]} ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
};

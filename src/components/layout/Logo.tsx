import React from "react";
import Link from "next/link";

export interface LogoProps {
  className?: string;
  showSubtitle?: boolean;
}

/**
 * Isolated Placeholder Logo Component
 *
 * NOTE: This is a neutral geometric/typographic placeholder.
 * It does NOT invent an official VNIT crest or logo.
 * Official department/institute branding assets can replace this component
 * seamlessly in later phases without altering layout structure.
 */
export const Logo: React.FC<LogoProps> = ({
  className = "",
  showSubtitle = true,
}) => {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-3 text-[var(--color-text-primary)] hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)] ${className}`.trim()}
      aria-label="TNP Portal - Department of Architecture & Planning, VNIT Nagpur"
    >
      {/* Neutral architectural geometric mark */}
      <span
        aria-hidden="true"
        className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-mono font-bold text-sm tracking-wider shadow-sm flex-shrink-0"
      >
        AP
      </span>

      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)] leading-none">
          TNP Portal
        </span>
        {showSubtitle && (
          <span className="text-xs text-[var(--color-text-secondary)] tracking-tight leading-tight mt-0.5 hidden sm:inline-block">
            Architecture & Planning • VNIT Nagpur
          </span>
        )}
      </div>
    </Link>
  );
};

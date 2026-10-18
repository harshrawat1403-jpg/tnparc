import React from "react";
import Link from "next/link";
import { Logo } from "./Logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/placements", label: "Placements" },
  { href: "/internships", label: "Internships" },
  { href: "/for-recruiters", label: "For Recruiters" },
  { href: "/contact", label: "Contact" },
] as const;

export const PublicHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Logo />
          </div>

          {/* Desktop Navigation */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] rounded-[var(--radius-sm)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                {link.label}
              </Link>
            ))}

            <div
              className="h-4 w-[1px] bg-[var(--color-border)] mx-2"
              aria-hidden="true"
            />

            <Link
              href="/login"
              className="ml-1 px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-inverse)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-md)] transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Sign In
            </Link>
          </nav>

          {/* Mobile Navigation Disclosure (Native HTML5 Details - No JS required, 100% accessible) */}
          <details className="md:hidden group relative">
            <summary
              className="list-none flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              aria-label="Toggle navigation menu"
            >
              <svg
                className="w-6 h-6 group-open:hidden"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
              <svg
                className="w-6 h-6 hidden group-open:block"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </summary>

            <nav
              aria-label="Mobile Navigation"
              className="absolute right-0 mt-2 w-56 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg py-2 z-50 flex flex-col gap-0.5"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-1.5 border-t border-[var(--color-border)]" />
              <div className="px-3 pt-1">
                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-[var(--color-text-inverse)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-md)] transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
};

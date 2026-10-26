import React from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

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
          <div className="flex-shrink-0 flex items-center min-h-[44px]">
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
                className="min-h-[44px] inline-flex items-center px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] rounded-[var(--radius-sm)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
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
              className="ml-1 min-h-[44px] inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-md)] transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Sign In
            </Link>
          </nav>

          {/* Accessible Mobile Navigation */}
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
};

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

export interface MobileNavProps {
  links: readonly { href: string; label: string }[];
}

export const MobileNav: React.FC<MobileNavProps> = ({ links }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press and restore focus to button
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="md:hidden relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-menu"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setIsOpen((prev) => !prev)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-[var(--radius-md)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
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
        ) : (
          <svg
            className="w-6 h-6"
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
        )}
      </button>

      {isOpen && (
        <nav
          id="mobile-navigation-menu"
          aria-label="Mobile Navigation"
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg py-2 z-50 flex flex-col gap-1"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="min-h-[44px] flex items-center px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              {link.label}
            </Link>
          ))}
          <div className="my-1 border-t border-[var(--color-border)]" />
          <div className="px-3 pt-1">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-md)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Sign In
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
};

import React from "react";
import Link from "next/link";
import { Container } from "../ui/Container";

export const PublicFooter: React.FC = () => {
  const currentYear = 2026;

  return (
    <footer className="w-full bg-[var(--color-surface)] border-t border-[var(--color-border)] mt-auto">
      <Container size="lg" className="py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Department Information */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-mono font-bold text-xs"
              >
                AP
              </span>
              <span className="font-semibold text-sm tracking-tight text-[var(--color-text-primary)]">
                Training & Placement Cell
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-md">
              Department of Architecture & Planning
              <br />
              Visvesvaraya National Institute of Technology (VNIT)
              <br />
              South Ambazari Road, Nagpur, Maharashtra — 440010, India
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2">
              Facilitating architectural education, professional internships,
              and career placements.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
              Portal Navigation
            </h2>
            <ul className="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
              <li>
                <Link
                  href="/"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  About TNP
                </Link>
              </li>
              <li>
                <Link
                  href="/placements"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Placement Statistics
                </Link>
              </li>
              <li>
                <Link
                  href="/internships"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Practical Training
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: For Recruiters & Access */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
              Recruiters & Students
            </h2>
            <ul className="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
              <li>
                <Link
                  href="/for-recruiters"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Recruiter Information
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Contact Placement Team
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Student / Staff Login
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-[var(--radius-sm)]"
                >
                  Student Activation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-text-secondary)]">
          <p>
            © {currentYear} Department of Architecture & Planning, VNIT Nagpur.
            All rights reserved.
          </p>
          <p className="text-[var(--color-text-secondary)]">
            Dedicated Training & Placement Portal • Phase 1 Foundation
          </p>
        </div>
      </Container>
    </footer>
  );
};

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Student Account Activation",
  description:
    "Activate your student account on the Department of Architecture & Planning TNP Portal, VNIT Nagpur.",
};

export default function SignupPage() {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center">
      <Container size="sm">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="text-center flex flex-col items-center gap-2">
            <Badge variant="default" size="md">
              Student Registration
            </Badge>
            <Heading level={1} className="text-2xl sm:text-3xl">
              Activate Student Account
            </Heading>
            <Text variant="secondary" className="max-w-md">
              Registration is strictly gated by the department academic roster.
              Enter your official institute email to claim your pre-registered
              profile.
            </Text>
          </div>

          {/* Signup Card */}
          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            <form
              aria-label="Student Account Activation Form"
              className="flex flex-col gap-4"
              onSubmit={undefined}
            >
              <Input
                label="Institutional Email"
                type="email"
                id="signup-email"
                name="email"
                autoComplete="email"
                required
                placeholder="bt21arc001@students.vnit.ac.in"
                helperText="Must match your pre-seeded entry on the department roster."
              />

              <Input
                label="Student ID / Roll Number"
                type="text"
                id="student-id"
                name="studentId"
                required
                placeholder="BT21ARC001"
                helperText="Department enrollment number (e.g., BT21ARC001 or MT23PLN001)."
              />

              <Input
                label="Create Password"
                type="password"
                id="signup-password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="Minimum 8 characters"
                helperText="At least 8 characters with a mix of letters and numbers."
              />

              <Input
                label="Confirm Password"
                type="password"
                id="signup-password-confirm"
                name="confirmPassword"
                autoComplete="new-password"
                required
                placeholder="Re-enter your password"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
              >
                Claim & Activate Account
              </Button>
            </form>

            {/* Roster Policy Note */}
            <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex flex-col gap-3">
              <div className="flex items-start gap-2 bg-[var(--color-surface-alt)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] mt-0.5">
                  NOTE
                </span>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <strong>Roster Verification Gate:</strong> If your email is
                  not found on the approved departmental student roster, account
                  creation will be blocked. If you believe this is an error,
                  please contact your student placement coordinator.
                </p>
              </div>

              <div className="flex items-start gap-2 bg-[var(--color-surface-alt)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] mt-0.5">
                  INFO
                </span>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <strong>Phase 1 Presentation Scaffold:</strong> Auth procedure
                  execution and database verification will be fully connected in
                  Phase 3.
                </p>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Already activated your account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SignupForm } from "./SignupForm";

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
            <SignupForm />

            {/* Roster Policy Note */}
            <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex flex-col gap-3">
              <div className="flex items-start gap-2 bg-[var(--color-surface-alt)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] mt-0.5">
                  NOTE
                </span>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <strong>Roster Verification Gate:</strong> Account activation
                  requires an unclaimed, active entry on the official
                  departmental roster. Academic program, batch, and enrollment
                  details derive directly from department records upon
                  verification.
                </p>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Already claimed your account?{" "}
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

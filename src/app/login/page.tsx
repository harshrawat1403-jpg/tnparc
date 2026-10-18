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
  title: "Sign In",
  description:
    "Sign in to the Department of Architecture & Planning TNP Portal, VNIT Nagpur.",
};

export default function LoginPage() {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center">
      <Container size="sm">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="text-center flex flex-col items-center gap-2">
            <Badge variant="default" size="md">
              TNP Portal Authentication
            </Badge>
            <Heading level={1} className="text-2xl sm:text-3xl">
              Sign In to Your Account
            </Heading>
            <Text variant="secondary" className="max-w-md">
              Access drives, manage student profiles, or administer departmental
              placements.
            </Text>
          </div>

          {/* Login Card */}
          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            <form
              aria-label="Sign In Form"
              className="flex flex-col gap-4"
              onSubmit={undefined}
            >
              <Input
                label="Email Address"
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                placeholder="student@students.vnit.ac.in"
                helperText="Use your institutional email address."
              />

              <Input
                label="Password"
                type="password"
                id="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[var(--color-text-secondary)]">
                  Forgot your password?
                </span>
                <span className="text-[var(--color-accent)] font-medium">
                  Contact T&P Coordinator
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
              >
                Sign In
              </Button>
            </form>

            {/* Phase Notice */}
            <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
              <div className="flex items-start gap-2 bg-[var(--color-surface-alt)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <span className="text-xs font-mono font-bold text-[var(--color-accent)] mt-0.5">
                  INFO
                </span>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <strong>Phase 1 Presentation Scaffold:</strong> Authentication
                  integration (Supabase Auth email/password, session tokens, and
                  roster validation) is scheduled for activation in Phase 3.
                </p>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">
                First time student activating account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  Activate Roster Account
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}

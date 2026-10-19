import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoginForm } from "./LoginForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to the Department of Architecture & Planning TNP Portal, VNIT Nagpur.",
};

interface LoginPageProps {
  searchParams: Promise<{
    redirectTo?: string;
    error?: string;
    notice?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  let initialError: string | undefined = undefined;
  if (params.error === "account_deactivated") {
    initialError =
      "Your account has been deactivated. Please contact the TNP office.";
  } else if (params.error === "auth_callback_failed") {
    initialError =
      "Authentication link was invalid or has expired. Please sign in or request a new link.";
  }

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
              Access drives, student profiles, coordinator tools, or placement
              administration.
            </Text>
          </div>

          {/* Login Card */}
          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            {params.notice === "password_updated" && (
              <div
                role="status"
                className="mb-4 p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900"
              >
                Password updated successfully. Please sign in with your new
                password.
              </div>
            )}

            <LoginForm
              redirectTo={params.redirectTo}
              initialError={initialError}
            />

            <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Eligible student activating your roster account?{" "}
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

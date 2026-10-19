import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Access Restricted",
  description:
    "You do not have authorization to access this departmental resource.",
};

export default function UnauthorizedPage() {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center">
      <Container size="sm">
        <div className="flex flex-col gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <Badge variant="warning" size="md">
              403 Restricted
            </Badge>
            <Heading level={1} className="text-2xl sm:text-3xl">
              Access Restricted
            </Heading>
            <Text variant="secondary" className="max-w-md">
              Your authenticated account does not possess the required
              departmental role or active placement privileges to access this
              page.
            </Text>
          </div>

          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-6">
              Department security boundaries separate active students,
              departmental coordinators, training & placement secretaries,
              administrators, and recruiters. If you believe this is an
              administrative error, please contact the TNP Office.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/">
                <Button variant="secondary" size="md">
                  Return to Home
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="primary" size="md">
                  Sign In with Different Account
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}

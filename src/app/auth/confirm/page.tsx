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
  title: "Account Confirmation",
  description:
    "Account confirmation details for the Department of Architecture & Planning TNP Portal.",
};

export default function ConfirmNoticePage() {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center">
      <Container size="sm">
        <div className="flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-2">
            <Badge variant="default" size="md">
              Registration Verification
            </Badge>
            <Heading level={1} className="text-2xl sm:text-3xl">
              Check Your Email
            </Heading>
            <Text variant="secondary" className="max-w-md">
              A verification link has been sent to your institutional email
              address.
            </Text>
          </div>

          <Card
            padding="lg"
            className="border-[var(--color-border)] shadow-sm text-center"
          >
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6">
              Please click the link inside the email to verify your address and
              complete your student account provisioning. Once confirmed, you
              will be redirected directly to your student placement dashboard.
            </p>

            <Link href="/login">
              <Button variant="secondary" size="md">
                Proceed to Sign In
              </Button>
            </Link>
          </Card>
        </div>
      </Container>
    </div>
  );
}

import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Password Recovery",
  description:
    "Request password recovery for your account on the Department of Architecture & Planning TNP Portal, VNIT Nagpur.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center">
      <Container size="sm">
        <div className="flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-2">
            <Badge variant="default" size="md">
              Password Recovery
            </Badge>
            <Heading level={1} className="text-2xl sm:text-3xl">
              Forgot Your Password?
            </Heading>
            <Text variant="secondary" className="max-w-md">
              Enter your email address and we will send you a secure link to
              reset your password.
            </Text>
          </div>

          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            <ForgotPasswordForm />
          </Card>
        </div>
      </Container>
    </div>
  );
}

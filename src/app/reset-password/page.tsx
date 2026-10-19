import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set New Password",
  description:
    "Reset your password on the Department of Architecture & Planning TNP Portal, VNIT Nagpur.",
};

export default function ResetPasswordPage() {
  return (
    <div className="py-12 sm:py-20 flex items-center justify-center">
      <Container size="sm">
        <div className="flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-2">
            <Badge variant="default" size="md">
              Security
            </Badge>
            <Heading level={1} className="text-2xl sm:text-3xl">
              Set New Password
            </Heading>
            <Text variant="secondary" className="max-w-md">
              Enter your new password below to regain access to your TNP
              account.
            </Text>
          </div>

          <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
            <ResetPasswordForm />
          </Card>
        </div>
      </Container>
    </div>
  );
}

"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StudentError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "test") {
      console.error("[StudentErrorBoundary]:", error);
    }
  }, [error]);

  return (
    <Container size="md" className="py-16">
      <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 text-red-600 mb-5 font-bold text-xl">
          !
        </div>
        <Heading
          level={2}
          className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2"
        >
          Student Portal Error
        </Heading>
        <Text
          variant="secondary"
          className="text-sm text-neutral-600 mb-6 max-w-md mx-auto"
        >
          An error occurred while loading this section of the student portal.
          Please try again or return to your dashboard.
        </Text>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="primary" size="sm" onClick={() => reset()}>
            Try Again
          </Button>
          <Link href="/student/dashboard">
            <Button variant="secondary" size="sm">
              Student Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}

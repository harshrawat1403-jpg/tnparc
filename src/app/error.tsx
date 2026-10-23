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

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log safe server/client diagnostic details without leaking into rendered DOM
    if (process.env.NODE_ENV !== "test") {
      console.error("[RootErrorBoundary]:", error);
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16">
      <Container size="sm" className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-600 mb-6 font-bold text-2xl">
          !
        </div>
        <Heading
          level={1}
          className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3"
        >
          An Unexpected Error Occurred
        </Heading>
        <Text
          variant="secondary"
          className="text-base text-neutral-600 mb-8 max-w-md mx-auto"
        >
          We encountered an issue processing your request. Please try again or
          return to the portal.
        </Text>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="primary" size="md" onClick={() => reset()}>
            Try Again
          </Button>
          <Link href="/">
            <Button variant="secondary" size="md">
              Return Home
            </Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}

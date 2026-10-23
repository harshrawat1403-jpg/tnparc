import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16">
      <Container size="sm" className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 text-neutral-600 mb-6 font-bold text-2xl">
          404
        </div>
        <Heading
          level={1}
          className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3"
        >
          Resource Not Found
        </Heading>
        <Text
          variant="secondary"
          className="text-base text-neutral-600 mb-8 max-w-md mx-auto"
        >
          The requested page or record does not exist, has been removed, or you
          do not have permission to view it.
        </Text>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/">
            <Button variant="primary" size="md">
              Return to Homepage
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="md">
              Sign In to Portal
            </Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}

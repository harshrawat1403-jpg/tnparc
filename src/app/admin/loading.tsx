import React from "react";
import { Container } from "@/components/ui/Container";

export default function AdminLoading() {
  return (
    <Container size="xl" className="py-8">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="space-y-6 animate-pulse"
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
          <div className="space-y-2">
            <div className="h-7 w-52 bg-neutral-200 rounded"></div>
            <div className="h-4 w-80 bg-neutral-100 rounded"></div>
          </div>
          <div className="h-9 w-32 bg-neutral-200 rounded"></div>
        </div>

        <div className="h-28 bg-neutral-100 rounded-lg border border-neutral-200"></div>

        <div className="h-72 bg-neutral-50 rounded-lg border border-neutral-200 p-6 space-y-4">
          <div className="h-5 w-44 bg-neutral-200 rounded"></div>
          <div className="space-y-3">
            <div className="h-10 bg-neutral-200/60 rounded"></div>
            <div className="h-10 bg-neutral-200/60 rounded"></div>
            <div className="h-10 bg-neutral-200/60 rounded"></div>
          </div>
        </div>
        <span className="sr-only">Loading administration console...</span>
      </div>
    </Container>
  );
}

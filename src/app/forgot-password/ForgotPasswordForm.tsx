"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { submitForgotPassword, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitForgotPassword,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div
          role="alert"
          className="p-3 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-[var(--radius-md)] border border-red-200 dark:border-red-900"
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          role="status"
          className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900"
        >
          {state.success}
        </div>
      )}

      <Input
        label="Account Email"
        type="email"
        id="email"
        name="email"
        autoComplete="email"
        required
        placeholder="user@vnit.ac.in"
        helperText="Enter your registered institutional or recruiter account email."
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full mt-2"
        disabled={isPending}
      >
        {isPending ? "Sending Recovery Link..." : "Send Password Reset Link"}
      </Button>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          Return to Sign In
        </Link>
      </div>
    </form>
  );
}

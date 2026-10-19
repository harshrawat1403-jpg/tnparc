"use client";

import React, { useActionState } from "react";
import { submitSignup, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitSignup,
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
        label="Institutional Email"
        type="email"
        id="signup-email"
        name="email"
        autoComplete="email"
        required
        placeholder="student@students.vnit.ac.in"
        helperText="Must match your pre-seeded entry on the department academic roster."
      />

      <Input
        label="Create Password"
        type="password"
        id="signup-password"
        name="password"
        autoComplete="new-password"
        required
        placeholder="Minimum 8 characters"
        helperText="At least 8 characters with numbers and letters."
      />

      <Input
        label="Confirm Password"
        type="password"
        id="signup-password-confirm"
        name="confirmPassword"
        autoComplete="new-password"
        required
        placeholder="Re-enter your password"
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full mt-2"
        disabled={isPending}
      >
        {isPending
          ? "Validating Roster & Claiming..."
          : "Claim & Activate Account"}
      </Button>
    </form>
  );
}

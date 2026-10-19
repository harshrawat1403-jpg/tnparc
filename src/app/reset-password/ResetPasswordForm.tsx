"use client";

import React, { useActionState } from "react";
import { submitResetPassword, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitResetPassword,
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

      <Input
        label="New Password"
        type="password"
        id="password"
        name="password"
        autoComplete="new-password"
        required
        placeholder="Minimum 8 characters"
        helperText="Choose a strong password with at least 8 characters."
      />

      <Input
        label="Confirm New Password"
        type="password"
        id="confirmPassword"
        name="confirmPassword"
        autoComplete="new-password"
        required
        placeholder="Re-enter your new password"
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full mt-2"
        disabled={isPending}
      >
        {isPending ? "Updating Password..." : "Update Password"}
      </Button>
    </form>
  );
}

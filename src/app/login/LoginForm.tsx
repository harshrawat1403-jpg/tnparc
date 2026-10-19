"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { submitLogin, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface LoginFormProps {
  redirectTo?: string;
  initialError?: string;
}

export function LoginForm({ redirectTo, initialError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitLogin,
    initialError ? { error: initialError } : {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}

      {state?.error && (
        <div
          role="alert"
          className="p-3 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-[var(--radius-md)] border border-red-200 dark:border-red-900"
        >
          {state.error}
        </div>
      )}

      <Input
        label="Email Address"
        type="email"
        id="email"
        name="email"
        autoComplete="email"
        required
        placeholder="bt21arc001@students.vnit.ac.in"
        helperText="Enter your official institutional or registered staff email."
      />

      <Input
        label="Password"
        type="password"
        id="password"
        name="password"
        autoComplete="current-password"
        required
        placeholder="••••••••••••"
      />

      <div className="flex items-center justify-between text-xs pt-1">
        <Link
          href="/forgot-password"
          className="text-[var(--color-accent)] hover:underline"
        >
          Forgot password?
        </Link>
        <span className="text-[var(--color-text-secondary)]">
          Need help? Contact TNP Office
        </span>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full mt-2"
        disabled={isPending}
      >
        {isPending ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
}

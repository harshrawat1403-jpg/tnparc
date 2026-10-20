"use client";

import React, { useActionState } from "react";
import {
  submitUpdateProfile,
  type StudentProfileActionState,
} from "@/lib/actions/student-profile";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface ProfileFormProps {
  initialData: {
    bio: string | null;
    publicHeadline: string | null;
    publicTagline: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    otherLinks: Array<{ title: string; url: string }>;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<
    StudentProfileActionState | null,
    FormData
  >(submitUpdateProfile, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div
          role="alert"
          className="p-3 text-sm rounded-[var(--radius-md)] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900"
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          role="status"
          className="p-3 text-sm rounded-[var(--radius-md)] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
        >
          {state.success}
          {state.profileCompleteness !== undefined && (
            <span className="block mt-1 font-medium">
              Profile Completeness: {state.profileCompleteness}%
            </span>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-[var(--color-text)] mb-1"
        >
          Contact Phone Number
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initialData.phone || ""}
          placeholder="+91 98765 43210"
        />
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Used by the Training & Placement office for urgent drive coordination.
        </p>
      </div>

      <div>
        <label
          htmlFor="publicHeadline"
          className="block text-sm font-medium text-[var(--color-text)] mb-1"
        >
          Professional Headline
        </label>
        <Input
          id="publicHeadline"
          name="publicHeadline"
          defaultValue={initialData.publicHeadline || ""}
          placeholder="e.g. Architectural Designer & BIM Specialist"
          maxLength={120}
        />
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          A concise summary of your professional focus (max 120 characters).
        </p>
      </div>

      <div>
        <label
          htmlFor="publicTagline"
          className="block text-sm font-medium text-[var(--color-text)] mb-1"
        >
          Short Tagline
        </label>
        <Input
          id="publicTagline"
          name="publicTagline"
          defaultValue={initialData.publicTagline || ""}
          placeholder="e.g. Sustainable urban design & parametric modeling"
          maxLength={200}
        />
      </div>

      <div>
        <label
          htmlFor="bio"
          className="block text-sm font-medium text-[var(--color-text)] mb-1"
        >
          Professional Bio
        </label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initialData.bio || ""}
          placeholder="Describe your design philosophy, areas of interest, architectural software expertise, and career aspirations..."
          rows={5}
          maxLength={2000}
        />
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Max 2000 characters.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="linkedinUrl"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            LinkedIn Profile URL
          </label>
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            defaultValue={initialData.linkedinUrl || ""}
            placeholder="https://linkedin.com/in/username"
          />
        </div>

        <div>
          <label
            htmlFor="portfolioUrl"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Digital Portfolio URL
          </label>
          <Input
            id="portfolioUrl"
            name="portfolioUrl"
            type="url"
            defaultValue={initialData.portfolioUrl || ""}
            placeholder="https://issuu.com/... or personal site"
          />
        </div>
      </div>

      <input
        type="hidden"
        name="otherLinks"
        value={JSON.stringify(initialData.otherLinks || [])}
      />

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving Profile..." : "Save Professional Profile"}
        </Button>
      </div>
    </form>
  );
}

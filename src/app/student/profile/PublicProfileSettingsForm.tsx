"use client";

import React, { useState, useActionState } from "react";
import Link from "next/link";
import {
  submitUpdatePublicProfileSettings,
  type PublicProfileSettingsActionState,
} from "@/lib/actions/student-profile";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface PublicProfileSettingsFormProps {
  initialData: {
    publicProfileEnabled: boolean;
    publicResumeEnabled: boolean;
    publicPortfolioEnabled: boolean;
    slug: string | null;
    headline: string | null;
    tagline: string | null;
  };
}

export function PublicProfileSettingsForm({
  initialData,
}: PublicProfileSettingsFormProps) {
  const [state, formAction, isPending] = useActionState<
    PublicProfileSettingsActionState | null,
    FormData
  >(submitUpdatePublicProfileSettings, null);

  const [enabled, setEnabled] = useState(initialData.publicProfileEnabled);
  const [resumeEnabled, setResumeEnabled] = useState(
    initialData.publicResumeEnabled
  );
  const [portfolioEnabled, setPortfolioEnabled] = useState(
    initialData.publicPortfolioEnabled
  );
  const [slug, setSlug] = useState(initialData.slug || "");

  const isSlugPermanent = Boolean(initialData.slug);
  const effectiveSlug = state?.slug || initialData.slug;
  const isCurrentlyPublic =
    state?.publicProfileEnabled !== undefined
      ? state.publicProfileEnabled
      : enabled;

  return (
    <form action={formAction} className="space-y-6">
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
        </div>
      )}

      {/* Main Public Profile Enable Toggle */}
      <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-[var(--color-text)]">
              Enable Public Student Profile
            </span>
            <Badge
              variant={isCurrentlyPublic ? "success" : "default"}
              size="sm"
            >
              {isCurrentlyPublic ? "Publicly Visible" : "Private (Off)"}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            When enabled, your professional profile and verified skills will be
            listed in the public batch directory.
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
          <input
            type="checkbox"
            name="publicProfileEnabled"
            value="true"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]" />
        </label>
      </div>

      {/* Public URL Slug Configuration */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Public Profile Slug
          </label>
          {isSlugPermanent && (
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Permanent (Immutable once set)
            </span>
          )}
        </div>

        <div className="flex rounded-[var(--radius-md)] shadow-sm">
          <span className="inline-flex items-center px-3 rounded-l-[var(--radius-md)] border border-r-0 border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs sm:text-sm">
            /students/profile/
          </span>
          <Input
            id="slug"
            name="slug"
            value={slug}
            readOnly={isSlugPermanent}
            onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
            placeholder="e.g. alice-sharma"
            className={`rounded-l-none text-xs sm:text-sm ${
              isSlugPermanent
                ? "bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-90"
                : ""
            }`}
            required={enabled}
          />
        </div>
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
          Must be 3-63 lowercase alphanumeric characters or hyphens.
          {isSlugPermanent
            ? " If you require a correction due to legal name change, contact a Super Administrator."
            : " Choose carefully: your slug cannot be modified once saved."}
        </p>
      </div>

      {/* Headline & Tagline */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label
            htmlFor="publicHeadline"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Public Professional Headline
          </label>
          <Input
            id="publicHeadline"
            name="publicHeadline"
            defaultValue={initialData.headline || ""}
            placeholder="e.g. Aspiring Urban Designer & Computational Architect"
            maxLength={120}
          />
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Displayed directly beneath your name on your public profile card
            (max 120 chars).
          </p>
        </div>

        <div>
          <label
            htmlFor="publicTagline"
            className="block text-sm font-medium text-[var(--color-text)] mb-1"
          >
            Public Tagline / Short Summary
          </label>
          <Textarea
            id="publicTagline"
            name="publicTagline"
            defaultValue={initialData.tagline || ""}
            placeholder="e.g. Focused on sustainable urban habitats, algorithmic massing, and heritage conservation."
            maxLength={200}
            rows={2}
          />
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Brief professional statement for public showcase listings (max 200
            chars).
          </p>
        </div>
      </div>

      {/* Granular Visibility Switches */}
      <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="publicResumeEnabled"
            value="true"
            checked={resumeEnabled}
            onChange={(e) => setResumeEnabled(e.target.checked)}
            className="mt-0.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          <div>
            <span className="block text-sm font-medium text-[var(--color-text)]">
              Display &ldquo;Resume Available on Request&rdquo; Indicator
            </span>
            <span className="block text-xs text-[var(--color-text-secondary)]">
              Shows recruiters that your complete verified resume is on file
              with the TNP cell. Does not allow anonymous file downloads.
            </span>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="publicPortfolioEnabled"
            value="true"
            checked={portfolioEnabled}
            onChange={(e) => setPortfolioEnabled(e.target.checked)}
            className="mt-0.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          <div>
            <span className="block text-sm font-medium text-[var(--color-text)]">
              Display External Portfolio Link Publicly
            </span>
            <span className="block text-xs text-[var(--color-text-secondary)]">
              Makes your portfolio URL clickable on public showcase cards and
              profile pages.
            </span>
          </div>
        </label>
      </div>

      {/* Action Buttons & Live Preview Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
        <div>
          {effectiveSlug && (
            <Button variant="secondary" size="sm" asChild>
              <Link
                href={`/students/profile/${effectiveSlug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Preview Public Profile</span>
                <span className="ml-1">&nearr;</span>
              </Link>
            </Button>
          )}
        </div>

        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving Privacy Settings..." : "Save Public Settings"}
        </Button>
      </div>
    </form>
  );
}

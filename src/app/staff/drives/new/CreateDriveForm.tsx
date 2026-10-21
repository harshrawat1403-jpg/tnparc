"use client";

import React, { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  submitCreateDrive,
  type DriveActionResult,
} from "@/lib/actions/drives";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface CompanyOption {
  id: string;
  name: string;
}

interface Props {
  companies: CompanyOption[];
}

export function CreateDriveForm({ companies }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    DriveActionResult | null,
    FormData
  >(submitCreateDrive, null);

  useEffect(() => {
    if (state?.success && state.driveId) {
      router.push(`/staff/drives/${state.driveId}`);
    }
  }, [state, router]);

  return (
    <Card className="p-6">
      <form action={formAction} className="flex flex-col gap-6">
        {state?.error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-sm text-red-600 dark:text-red-400">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded text-sm text-green-600 dark:text-green-400">
            {state.success} Redirecting to drive configuration...
          </div>
        )}

        {/* Company Selection */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Company <span className="text-red-500">*</span>
          </label>
          <Select name="company_id" required defaultValue="">
            <option value="" disabled>
              Select a company...
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {companies.length === 0 && (
            <p className="text-xs text-amber-500 mt-1">
              No active companies found. Please create a company first in the
              Companies Directory.
            </p>
          )}
        </div>

        {/* Drive Title */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Drive Title <span className="text-red-500">*</span>
          </label>
          <Input
            name="title"
            placeholder="e.g. Graduate Architect Campus Hiring 2026"
            required
            maxLength={200}
          />
        </div>

        {/* Drive Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Drive Type <span className="text-red-500">*</span>
            </label>
            <Select name="drive_type" required defaultValue="PLACEMENT">
              <option value="PLACEMENT">Full-Time Placement</option>
              <option value="INTERNSHIP">Internship</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Location</label>
            <Input
              name="location"
              placeholder="e.g. Nagpur / Mumbai / Hybrid"
              maxLength={200}
            />
          </div>
        </div>

        {/* Deadline and Package */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Application Deadline
            </label>
            <Input name="application_deadline" type="datetime-local" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Package (LPA CTC)
            </label>
            <Input
              name="package_lpa"
              type="number"
              step="0.01"
              min="0"
              max="9999.99"
              placeholder="e.g. 12.50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Monthly Stipend (₹)
            </label>
            <Input
              name="stipend_monthly"
              type="number"
              step="1"
              min="0"
              placeholder="e.g. 35000"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Job Description &amp; Role Overview
          </label>
          <Textarea
            name="description"
            rows={4}
            placeholder="Outline job responsibilities, skills needed, project types..."
          />
        </div>

        {/* Compensation Details */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Compensation Details &amp; Perks
          </label>
          <Textarea
            name="compensation_details"
            rows={2}
            placeholder="Breakdown of fixed vs variable, probation stipend, bonuses..."
          />
        </div>

        {/* Requirements Info */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Additional Requirements &amp; Instructions
          </label>
          <Textarea
            name="requirements_info"
            rows={2}
            placeholder="Portfolio link submission required, laptop requirement, bonds..."
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/staff/drives")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || companies.length === 0}
          >
            {isPending ? "Creating Drive..." : "Create Drive (DRAFT)"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

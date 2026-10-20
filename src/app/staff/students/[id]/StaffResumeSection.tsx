"use client";

import React, { useState, useTransition } from "react";
import { getResumeDownloadUrl } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/Button";

interface StaffResumeSectionProps {
  storagePath: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
}

export function StaffResumeSection({
  storagePath,
  fileName,
  fileSizeBytes,
  uploadedAt,
}: StaffResumeSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!storagePath) {
    return (
      <p className="text-xs text-[var(--color-text-secondary)] italic">
        No active placement resume registered by this student.
      </p>
    );
  }

  const handleDownload = () => {
    setError(null);
    startTransition(async () => {
      const res = await getResumeDownloadUrl(storagePath);
      if (res.error || !res.url) {
        setError(res.error || "Failed to generate download URL.");
      } else {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    });
  };

  const formattedSize = fileSizeBytes
    ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : "PDF Document";

  const formattedDate = uploadedAt
    ? new Date(uploadedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[var(--color-surface-alt)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">
            {fileName || "Placement_Resume.pdf"}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {formattedSize} {formattedDate && `• Uploaded on ${formattedDate}`}
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={handleDownload}
        >
          {isPending ? "Generating Link..." : "Download / View Resume"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-[var(--color-danger)] font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

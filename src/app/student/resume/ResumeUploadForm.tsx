"use client";

import React, { useState } from "react";
import { submitUploadResume } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/Button";

interface ResumeUploadFormProps {
  hasExistingResume: boolean;
}

export function ResumeUploadForm({ hasExistingResume }: ResumeUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5242880) {
      setStatus({ error: "File exceeds 5 MB. Please select a smaller PDF." });
      setFile(null);
      return;
    }

    if (
      selected.type !== "application/pdf" &&
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      setStatus({ error: "Invalid format. Only PDF files are supported." });
      setFile(null);
      return;
    }

    setFile(selected);
    setStatus(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus({ error: "Please select a PDF resume file first." });
      return;
    }

    setIsUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const res = await submitUploadResume(formData);
      if (res.error) {
        setStatus({ error: res.error });
      } else {
        setStatus({
          success: res.success || "Resume successfully uploaded.",
        });
        setFile(null);
      }
    } catch {
      setStatus({ error: "An unexpected error occurred during upload." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      {status?.error && (
        <div
          role="alert"
          className="p-3 text-sm rounded-[var(--radius-md)] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900"
        >
          {status.error}
        </div>
      )}

      {status?.success && (
        <div
          role="status"
          className="p-3 text-sm rounded-[var(--radius-md)] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
        >
          {status.success}
        </div>
      )}

      <div className="border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-6 text-center hover:border-[var(--color-primary)] transition-colors">
        <svg
          className="mx-auto h-10 w-10 text-[var(--color-text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>

        <div className="mt-3">
          <label
            htmlFor="resumeInput"
            className="cursor-pointer text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {hasExistingResume
              ? "Select a new PDF to replace your current resume"
              : "Select your resume (PDF only)"}
          </label>
          <input
            id="resumeInput"
            name="resume"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={isUploading}
            className="sr-only"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Max 5 MB. PDF format only.
          </p>
        </div>

        {file && (
          <div className="mt-3 p-2 bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)] inline-flex items-center gap-2 text-xs">
            <span className="font-medium text-[var(--color-text)]">
              {file.name}
            </span>
            <span className="text-[var(--color-text-secondary)]">
              ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!file || isUploading}>
          {isUploading
            ? "Uploading Resume..."
            : hasExistingResume
              ? "Replace Current Resume"
              : "Upload Resume"}
        </Button>
      </div>
    </form>
  );
}

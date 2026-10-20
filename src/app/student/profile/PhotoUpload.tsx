"use client";

import React, { useState } from "react";
import { submitUploadPhoto } from "@/lib/actions/student-profile";
import { Button } from "@/components/ui/Button";

interface PhotoUploadProps {
  currentPhotoPath: string | null;
  signedPhotoUrl?: string | null;
}

export function PhotoUpload({
  currentPhotoPath,
  signedPhotoUrl,
}: PhotoUploadProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    signedPhotoUrl || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (<= 2MB)
    if (file.size > 2097152) {
      setStatusMessage({
        error: "Photo size exceeds 2 MB. Please select a smaller image.",
      });
      return;
    }

    // Validate MIME
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setStatusMessage({
        error: "Unsupported format. Only JPEG, PNG, and WebP are allowed.",
      });
      return;
    }

    // Generate local preview
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setStatusMessage(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await submitUploadPhoto(formData);
      if (res.error) {
        setStatusMessage({ error: res.error });
      } else {
        setStatusMessage({
          success: res.success || "Photo uploaded successfully.",
        });
      }
    } catch {
      setStatusMessage({ error: "An unexpected upload error occurred." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-28 h-28 rounded-full border-2 border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-text-secondary)] shadow-inner flex-shrink-0">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="Profile Preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-12 h-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 space-y-2 text-center sm:text-left">
        <div>
          <label
            htmlFor="photoUpload"
            className="inline-block cursor-pointer font-medium text-sm text-[var(--color-primary)] hover:underline"
          >
            {currentPhotoPath ? "Change Profile Photo" : "Upload Profile Photo"}
          </label>
          <input
            id="photoUpload"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="sr-only"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Accepts JPEG, PNG, or WebP. Maximum file size 2 MB.
          </p>
        </div>

        {isUploading && (
          <p className="text-xs text-[var(--color-primary)] animate-pulse">
            Uploading and processing photo...
          </p>
        )}

        {statusMessage?.error && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {statusMessage.error}
          </p>
        )}

        {statusMessage?.success && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {statusMessage.success}
          </p>
        )}

        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => document.getElementById("photoUpload")?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Select Image"}
          </Button>
        </div>
      </div>
    </div>
  );
}

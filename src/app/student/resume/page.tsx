import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ResumeUploadForm } from "./ResumeUploadForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Placement Resume",
  description:
    "Upload, manage, and download your verified placement resume document.",
};

export default async function StudentResumePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/resume");
  }

  // Verify caller profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // Fetch current resume
  const { data: currentResume } = await supabase
    .from("documents")
    .select("id, file_name, file_size_bytes, storage_path, uploaded_at")
    .eq("owner_id", user.id)
    .eq("document_type", "RESUME")
    .eq("is_current", true)
    .maybeSingle();

  // Generate 5-minute signed URL for downloading own current resume
  let signedDownloadUrl: string | null = null;
  if (currentResume?.storage_path) {
    const { data: signedData } = await supabase.storage
      .from("resumes")
      .createSignedUrl(currentResume.storage_path, 300);
    signedDownloadUrl = signedData?.signedUrl || null;
  }

  return (
    <div className="py-10">
      <Container size="md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/student/dashboard"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  &larr; Back to Dashboard
                </Link>
                <Badge variant="default" size="sm">
                  {profile.student_lifecycle_status || "STUDENT_ACTIVE"}
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Placement Resume
              </Heading>
              <Text variant="secondary" className="text-sm">
                Your authoritative PDF resume used for recruitment drive
                applications.
              </Text>
            </div>

            <Link
              href="/student/profile"
              className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
            >
              Professional Profile
            </Link>
          </div>

          {/* Current Resume Status Card */}
          <Card padding="lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase font-medium tracking-wider text-[var(--color-text-secondary)] mb-1">
                  Active Resume Status
                </p>
                {currentResume ? (
                  <div>
                    <Heading level={3} className="text-lg">
                      {currentResume.file_name || "resume.pdf"}
                    </Heading>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Uploaded on{" "}
                      {new Date(currentResume.uploaded_at).toLocaleDateString()}{" "}
                      &bull;{" "}
                      {currentResume.file_size_bytes
                        ? (
                            currentResume.file_size_bytes /
                            (1024 * 1024)
                          ).toFixed(2)
                        : "0.00"}{" "}
                      MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Heading
                      level={3}
                      className="text-lg text-amber-700 dark:text-amber-400"
                    >
                      No Resume Uploaded
                    </Heading>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      You must upload a current resume to complete your
                      placement profile.
                    </p>
                  </div>
                )}
              </div>

              {signedDownloadUrl && (
                <div>
                  <a
                    href={signedDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download Current Resume
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Upload / Replace Form Card */}
          <Card padding="lg">
            <Heading level={3} className="text-base mb-1">
              {currentResume ? "Replace Resume" : "Upload New Resume"}
            </Heading>
            <Text variant="secondary" className="text-xs mb-4">
              Uploading a new resume marks your existing resume as non-current.
              Only one current resume is maintained.
            </Text>
            <ResumeUploadForm hasExistingResume={!!currentResume} />
          </Card>
        </div>
      </Container>
    </div>
  );
}

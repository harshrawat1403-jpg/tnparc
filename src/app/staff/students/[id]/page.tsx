import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AcademicVerificationForm } from "./AcademicVerificationForm";
import { StaffResumeSection } from "./StaffResumeSection";

export const instant = false;

export const metadata: Metadata = {
  title: "Student Profile Details",
  description: "View student academic records, resume, and profile details.",
};

interface StaffStudentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffStudentDetailPage({
  params,
}: StaffStudentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify staff role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/students/${id}`);
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    viewerProfile &&
    viewerProfile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"].includes(
      viewerProfile.role
    );

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch student profile and academic record.
  // Coordinator scoping is strictly enforced at database level via RLS
  // on academic_records!inner (can_access_student) and student_profiles.
  const { data: student, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      display_name,
      role,
      avatar_url,
      student_lifecycle_status,
      created_at,
      student_profiles (
        bio,
        public_headline,
        public_tagline,
        phone,
        linkedin_url,
        portfolio_url,
        other_links,
        profile_photo_path,
        profile_completeness
      ),
      academic_records!academic_records_profile_id_fkey!inner (
        id,
        program_id,
        batch,
        cgpa,
        active_backlogs,
        verification_status,
        verified_at,
        verified_by,
        academic_programs (
          id,
          code,
          display_name,
          degree_level
        )
      )
    `
    )
    .eq("id", id)
    .eq("role", "STUDENT")
    .single();

  if (error || !student) {
    notFound();
  }

  const sp = Array.isArray(student.student_profiles)
    ? student.student_profiles[0]
    : student.student_profiles;
  const ar = Array.isArray(student.academic_records)
    ? student.academic_records[0]
    : student.academic_records;
  const prog = Array.isArray(ar?.academic_programs)
    ? ar?.academic_programs[0]
    : ar?.academic_programs;

  // Fetch verifier's name if verified
  let verifierName: string | null = null;
  if (ar?.verified_by) {
    const { data: verifier } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", ar.verified_by)
      .single();
    verifierName = verifier?.display_name || null;
  }

  // Fetch current placement resume
  const { data: currentResume } = await supabase
    .from("documents")
    .select(
      "id, file_name, file_size_bytes, mime_type, storage_path, uploaded_at"
    )
    .eq("owner_id", id)
    .eq("document_type", "RESUME")
    .eq("is_current", true)
    .maybeSingle();

  // Verification authority check: Super Admin & TNP Secretary only
  const canVerify = ["SUPER_ADMIN", "TNP_SECRETARY"].includes(
    viewerProfile.role
  );

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/students"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  ← Student Directory
                </Link>
                <span className="text-[var(--color-border)]">•</span>
                <Badge variant="default" size="sm">
                  {prog?.code || "Program"}
                </Badge>
                <Badge variant="default" size="sm">
                  Batch {ar?.batch || "—"}
                </Badge>
                {ar?.verification_status === "VERIFIED" ? (
                  <Badge variant="success" size="sm">
                    VERIFIED
                  </Badge>
                ) : ar?.verification_status === "CORRECTION_PENDING" ? (
                  <Badge variant="info" size="sm">
                    CORRECTION_PENDING
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    UNVERIFIED
                  </Badge>
                )}
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                {student.display_name}
              </Heading>
              <Text variant="secondary" className="text-sm">
                {prog?.display_name} ({prog?.degree_level}) — Batch {ar?.batch}
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/staff/students">
                <Button variant="secondary" size="sm">
                  Back to Directory
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Academic Details & Profile */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Academic Record Card */}
              <Card padding="lg" className="border-[var(--color-border)]">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
                  <Heading level={3} className="text-base font-semibold">
                    Academic Standing
                  </Heading>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Institutional Record
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                      Current CGPA
                    </div>
                    <div className="text-xl font-mono font-bold text-[var(--color-text-primary)]">
                      {ar?.cgpa !== null && ar?.cgpa !== undefined
                        ? Number(ar.cgpa).toFixed(2)
                        : "—"}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                      Active Backlogs
                    </div>
                    <div className="text-xl font-mono font-bold text-[var(--color-text-primary)]">
                      {ar?.active_backlogs !== null &&
                      ar?.active_backlogs !== undefined
                        ? ar.active_backlogs
                        : "0"}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                      Batch Year
                    </div>
                    <div className="text-xl font-mono font-bold text-[var(--color-text-primary)]">
                      {ar?.batch || "—"}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                      Status
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      {ar?.verification_status}
                    </div>
                  </div>
                </div>

                {ar?.verification_status === "VERIFIED" && (
                  <div className="text-xs text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border)] flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Verified by:{" "}
                      <strong className="text-[var(--color-text-primary)]">
                        {verifierName || "Authorized Staff"}
                      </strong>
                    </span>
                    {ar.verified_at && (
                      <span>
                        Verified on:{" "}
                        <strong className="text-[var(--color-text-primary)]">
                          {new Date(ar.verified_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </strong>
                      </span>
                    )}
                  </div>
                )}
              </Card>

              {/* Placement Resume Card */}
              <Card padding="lg" className="border-[var(--color-border)]">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
                  <Heading level={3} className="text-base font-semibold">
                    Current Placement Resume
                  </Heading>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Private Document
                  </span>
                </div>

                <StaffResumeSection
                  storagePath={currentResume?.storage_path || null}
                  fileName={currentResume?.file_name || null}
                  fileSizeBytes={currentResume?.file_size_bytes || null}
                  uploadedAt={currentResume?.uploaded_at || null}
                />
              </Card>

              {/* Academic Verification / Correction Section */}
              {canVerify ? (
                <AcademicVerificationForm
                  targetProfileId={id}
                  currentCgpa={ar?.cgpa ? Number(ar.cgpa) : null}
                  currentActiveBacklogs={ar?.active_backlogs ?? null}
                  currentStatus={ar?.verification_status || "UNVERIFIED"}
                />
              ) : (
                <Card padding="md" className="border-[var(--color-border)]">
                  <Heading level={3} className="text-sm font-semibold mb-1">
                    Read-Only Scope Access
                  </Heading>
                  <Text variant="secondary" className="text-xs leading-relaxed">
                    As a TNP Coordinator, you have read-only visibility into
                    students within your assigned program and batch scope.
                    Academic verification and record correction authority is
                    strictly restricted to the TNP Secretary and Super Admin per
                    institutional governance rules.
                  </Text>
                </Card>
              )}
            </div>

            {/* Right 1 Col: Student Profile & Contacts */}
            <div className="flex flex-col gap-6">
              {/* Profile Card */}
              <Card padding="lg" className="border-[var(--color-border)]">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
                  <Heading level={3} className="text-base font-semibold">
                    Student Profile
                  </Heading>
                  <Badge variant="default" size="sm">
                    {sp?.profile_completeness ?? 0}% Complete
                  </Badge>
                </div>

                <div className="flex flex-col gap-4 text-sm">
                  {sp?.public_headline && (
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                        Headline
                      </div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        {sp.public_headline}
                      </div>
                    </div>
                  )}

                  {sp?.public_tagline && (
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                        Tagline
                      </div>
                      <div className="text-xs text-[var(--color-text-primary)] italic">
                        {sp.public_tagline}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                      Contact Phone
                    </div>
                    <div className="text-xs font-mono text-[var(--color-text-primary)]">
                      {sp?.phone || "Not provided"}
                    </div>
                  </div>

                  {sp?.bio && (
                    <div>
                      <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">
                        Professional Bio
                      </div>
                      <p className="text-xs text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line bg-[var(--color-surface-alt)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                        {sp.bio}
                      </p>
                    </div>
                  )}

                  {/* Professional Links */}
                  <div className="pt-2 border-t border-[var(--color-border)] flex flex-col gap-2">
                    <div className="text-xs font-medium text-[var(--color-text-primary)]">
                      Links & Portfolios
                    </div>

                    {sp?.linkedin_url ? (
                      <a
                        href={sp.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-accent)] hover:underline truncate"
                      >
                        LinkedIn: {sp.linkedin_url}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">
                        No LinkedIn profile linked
                      </span>
                    )}

                    {sp?.portfolio_url ? (
                      <a
                        href={sp.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-accent)] hover:underline truncate"
                      >
                        Portfolio: {sp.portfolio_url}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">
                        No portfolio URL linked
                      </span>
                    )}
                  </div>
                </div>
              </Card>

              {/* Scope & Audit Governance Notice */}
              <Card
                padding="md"
                className="border-[var(--color-border)] bg-[var(--color-surface-alt)]/50"
              >
                <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <strong>Access Policy:</strong> All profile views and document
                  downloads are subject to row-level security and institutional
                  audit logging. Resumes are protected by short-lived signed
                  tokens.
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

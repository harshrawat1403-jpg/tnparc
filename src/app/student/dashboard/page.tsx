import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitSignOut } from "@/lib/actions/auth";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const instant = false;

export const metadata: Metadata = {
  title: "Student Dashboard",
  description:
    "Student placement dashboard with profile completeness, academic standing, and resume status.",
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/dashboard");
  }

  // 1. Fetch profiles row
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // 2. Fetch student_profiles row
  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select(
      "phone, bio, public_headline, linkedin_url, portfolio_url, profile_photo_path, profile_completeness"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  // 3. Fetch academic record
  const { data: academic } = await supabase
    .from("academic_records")
    .select(
      "batch, cgpa, active_backlogs, verification_status, verified_at, academic_programs(display_name, code)"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  // 4. Fetch current resume
  const { data: resume } = await supabase
    .from("documents")
    .select("id, file_name, uploaded_at, storage_path")
    .eq("owner_id", user.id)
    .eq("document_type", "RESUME")
    .eq("is_current", true)
    .maybeSingle();

  // 5. Fetch active skills count
  const { count: skillsCount } = await supabase
    .from("student_skills")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("is_active", true);

  const completeness = studentProfile?.profile_completeness ?? 0;
  const isVerified = academic?.verification_status === "VERIFIED";

  const programTitle =
    (Array.isArray(academic?.academic_programs)
      ? academic?.academic_programs[0]?.display_name
      : (academic?.academic_programs as { display_name?: string } | null)
          ?.display_name) || "B.Arch";

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Student Portal
                </Badge>
                <Badge variant={isVerified ? "success" : "default"} size="sm">
                  {profile.student_lifecycle_status || "STUDENT_ACTIVE"}
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Welcome, {profile.display_name}
              </Heading>
              <Text variant="secondary" className="text-sm">
                Department of Architecture & Planning — VNIT Nagpur
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/skills"
                className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] font-medium"
              >
                Skills ({skillsCount ?? 0}/15)
              </Link>
              <Link
                href="/student/profile"
                className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 font-medium"
              >
                Edit Profile
              </Link>
              <form action={submitSignOut}>
                <Button type="submit" variant="secondary" size="sm">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>

          {/* Profile Completeness Hero Card */}
          <Card padding="lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Recruitment Readiness
                </p>
                <Heading level={2} className="text-xl mt-0.5">
                  Profile Completeness: {completeness}%
                </Heading>
                <Text variant="secondary" className="text-xs mt-1">
                  Complete your profile and upload your resume to be ready for
                  upcoming placement drives.
                </Text>
              </div>

              <div className="text-right">
                <Link
                  href="/student/profile"
                  className="text-xs text-[var(--color-primary)] font-medium hover:underline"
                >
                  Update Information &rarr;
                </Link>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-3 overflow-hidden border border-[var(--color-border)]">
              <div
                className="bg-[var(--color-primary)] h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(completeness, 100)}%` }}
              />
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[var(--color-border)] text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={
                    studentProfile?.phone
                      ? "text-emerald-600 font-bold"
                      : "text-[var(--color-text-secondary)] font-medium"
                  }
                >
                  {studentProfile?.phone ? "✓" : "○"}
                </span>
                <span>Contact Phone</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={
                    studentProfile?.bio || studentProfile?.public_headline
                      ? "text-emerald-600 font-bold"
                      : "text-[var(--color-text-secondary)] font-medium"
                  }
                >
                  {studentProfile?.bio || studentProfile?.public_headline
                    ? "✓"
                    : "○"}
                </span>
                <span>Professional Bio</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={
                    studentProfile?.linkedin_url
                      ? "text-emerald-600 font-bold"
                      : "text-[var(--color-text-secondary)] font-medium"
                  }
                >
                  {studentProfile?.linkedin_url ? "✓" : "○"}
                </span>
                <span>LinkedIn Profile</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={
                    resume
                      ? "text-emerald-600 font-bold"
                      : "text-[var(--color-text-secondary)] font-medium"
                  }
                >
                  {resume ? "✓" : "○"}
                </span>
                <span>Placement Resume</span>
              </div>
            </div>
          </Card>

          {/* Quick Stats & Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Academic Standing */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="text-base">
                  Academic Record
                </Heading>
                <Badge variant={isVerified ? "success" : "default"} size="sm">
                  {academic?.verification_status || "UNVERIFIED"}
                </Badge>
              </div>
              <p className="text-sm font-medium">{programTitle}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Batch of {academic?.batch || "N/A"}
              </p>

              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex justify-between text-xs">
                <div>
                  <span className="text-[var(--color-text-secondary)]">
                    CGPA:{" "}
                  </span>
                  <strong>
                    {academic?.cgpa !== null && academic?.cgpa !== undefined
                      ? Number(academic.cgpa).toFixed(2)
                      : "Pending"}
                  </strong>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">
                    Backlogs:{" "}
                  </span>
                  <strong>{academic?.active_backlogs ?? "—"}</strong>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href="/student/profile/academic"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  View Full Academic Details &rarr;
                </Link>
              </div>
            </Card>

            {/* Placement & Internship Drives */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="text-base">
                  Placement &amp; Internship Drives
                </Heading>
                <Badge variant="info" size="sm">
                  Drives
                </Badge>
              </div>
              <p className="text-sm font-medium">Explore Opportunities</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Browse published drives, check your authoritative eligibility
                status, and view criteria.
              </p>

              <div className="mt-6 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href="/student/drives"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  View Placement Drives &rarr;
                </Link>
              </div>
            </Card>

            {/* My Applications Card */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="text-base">
                  My Applications
                </Heading>
                <Badge variant="info" size="sm">
                  Applications
                </Badge>
              </div>
              <p className="text-sm font-medium">Track Status &amp; Timeline</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Monitor your application status transitions, interview rounds,
                and permanent history.
              </p>

              <div className="mt-6 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href="/student/applications"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  View My Applications &rarr;
                </Link>
              </div>
            </Card>

            {/* Resume Card */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="text-base">
                  Placement Resume
                </Heading>
                <Badge variant={resume ? "success" : "default"} size="sm">
                  {resume ? "Active" : "Missing"}
                </Badge>
              </div>
              <p className="text-sm font-medium truncate">
                {resume?.file_name || "No resume on file"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {resume
                  ? `Uploaded on ${new Date(
                      resume.uploaded_at
                    ).toLocaleDateString()}`
                  : "Required for placement applications"}
              </p>

              <div className="mt-6 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href="/student/resume"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  {resume ? "Manage Resume &rarr;" : "Upload Resume PDF &rarr;"}
                </Link>
              </div>
            </Card>

            {/* Skills & Endorsements */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="text-base">
                  Skills & Endorsements
                </Heading>
                <Badge
                  variant={skillsCount && skillsCount > 0 ? "info" : "default"}
                  size="sm"
                >
                  {skillsCount || 0} / 15 Claimed
                </Badge>
              </div>
              <p className="text-sm font-medium">Advisory Skills</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Claim up to 15 skills, attach evidence, and track verification.
              </p>

              <div className="mt-6 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href="/student/skills"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  Manage Skills & Evidence &rarr;
                </Link>
              </div>
            </Card>

            {/* Professional Dossier */}
            <Card padding="md">
              <Heading level={3} className="text-base mb-2">
                Professional Dossier
              </Heading>
              <p className="text-sm font-medium truncate">
                {studentProfile?.public_headline || "Headline not set"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {studentProfile?.phone || "No phone registered"}
              </p>

              <div className="mt-6 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href="/student/profile"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  Edit Profile Information &rarr;
                </Link>
              </div>
            </Card>

            {/* Announcements Card */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="text-base">
                  Department Notices
                </Heading>
                <Badge variant="info" size="sm">
                  Announcements
                </Badge>
              </div>
              <p className="text-sm font-medium">Placement Bulletins</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                View campus recruitment circulars, deadlines, and drive updates.
              </p>

              <div className="mt-6 pt-3 border-t border-[var(--color-border)]">
                <Link
                  href="/student/announcements"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  View Announcements &rarr;
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

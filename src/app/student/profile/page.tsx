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
import { ProfileForm } from "./ProfileForm";
import { PhotoUpload } from "./PhotoUpload";
import { PublicProfileSettingsForm } from "./PublicProfileSettingsForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Professional Profile",
  description:
    "Manage your professional bio, contact details, and portfolio links.",
};

export default async function StudentProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/profile");
  }

  // Fetch profiles row
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // Fetch student_profiles row
  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select(
      "bio, public_headline, public_tagline, phone, linkedin_url, portfolio_url, other_links, profile_photo_path, profile_completeness, public_profile_enabled, public_resume_enabled, public_portfolio_enabled, public_profile_slug"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  // Fetch academic record
  const { data: academic } = await supabase
    .from("academic_records")
    .select(
      "batch, verification_status, program_id, academic_programs(display_name, code)"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  // Generate signed photo URL if path exists
  let signedPhotoUrl: string | null = null;
  if (studentProfile?.profile_photo_path) {
    const { data: signedData } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(studentProfile.profile_photo_path, 300);
    signedPhotoUrl = signedData?.signedUrl || null;
  }

  const progData = academic?.academic_programs;
  const programName =
    (Array.isArray(progData)
      ? progData[0]?.display_name
      : progData?.display_name) || "Architecture & Planning";

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
                Professional Profile
              </Heading>
              <Text variant="secondary" className="text-sm">
                Maintain your professional headline, bio, contact details, and
                portfolio.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/profile/academic"
                className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                Academic Data
              </Link>
              <Link
                href="/student/resume"
                className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                Resume
              </Link>
            </div>
          </div>

          {/* Institutional Identity Card (Read-Only) */}
          <Card
            padding="md"
            className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase font-medium tracking-wider text-[var(--color-text-secondary)] mb-1">
                  Institutional Student Identity (Verified by Department)
                </p>
                <Heading level={3} className="text-lg">
                  {profile.display_name}
                </Heading>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {user.email} &bull; {programName} ({academic?.batch || "N/A"})
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Academic Verification
                </p>
                <Badge
                  variant={
                    academic?.verification_status === "VERIFIED"
                      ? "success"
                      : "default"
                  }
                  size="sm"
                  className="mt-0.5"
                >
                  {academic?.verification_status || "UNVERIFIED"}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Profile Photo Card */}
          <Card padding="lg">
            <Heading level={3} className="text-base mb-1">
              Profile Photo
            </Heading>
            <Text variant="secondary" className="text-xs mb-4">
              Upload a professional portrait for recruitment dossiers.
            </Text>
            <PhotoUpload
              currentPhotoPath={studentProfile?.profile_photo_path || null}
              signedPhotoUrl={signedPhotoUrl}
            />
          </Card>

          {/* Public Talent Showcase & Privacy Settings */}
          <Card padding="lg">
            <Heading level={3} className="text-base mb-1">
              Public Talent Directory & Showcase
            </Heading>
            <Text variant="secondary" className="text-xs mb-4">
              Control your public presence on the departmental student directory
              and recruiter talent listings.
            </Text>
            <PublicProfileSettingsForm
              initialData={{
                publicProfileEnabled:
                  studentProfile?.public_profile_enabled || false,
                publicResumeEnabled:
                  studentProfile?.public_resume_enabled || false,
                publicPortfolioEnabled:
                  studentProfile?.public_portfolio_enabled || false,
                slug: studentProfile?.public_profile_slug || null,
                headline: studentProfile?.public_headline || null,
                tagline: studentProfile?.public_tagline || null,
              }}
            />
          </Card>

          {/* Editable Professional Fields */}
          <Card padding="lg">
            <Heading level={3} className="text-base mb-1">
              Professional Details
            </Heading>
            <Text variant="secondary" className="text-xs mb-4">
              Provide your professional summary and verified links.
            </Text>
            <ProfileForm
              initialData={{
                bio: studentProfile?.bio || null,
                publicHeadline: studentProfile?.public_headline || null,
                publicTagline: studentProfile?.public_tagline || null,
                phone: studentProfile?.phone || null,
                linkedinUrl: studentProfile?.linkedin_url || null,
                portfolioUrl: studentProfile?.portfolio_url || null,
                otherLinks:
                  (studentProfile?.other_links as Array<{
                    title: string;
                    url: string;
                  }>) || [],
              }}
            />
          </Card>
        </div>
      </Container>
    </div>
  );
}

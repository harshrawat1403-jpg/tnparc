import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { StaffDriveDetailClient } from "./StaffDriveDetailClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Manage Placement Drive | Staff Portal",
  description:
    "Configure eligibility criteria, cohort targeting, and recruiter access.",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StaffDriveDetailPage({ params }: PageProps) {
  const { id: driveId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/drives/${driveId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  const canPublishOrClose = ["SUPER_ADMIN", "TNP_SECRETARY"].includes(
    profile.role
  );

  // 1. Fetch drive
  const { data: drive, error: driveErr } = await supabase
    .from("placement_drives")
    .select(
      `
      *,
      company:companies(id, name, website, is_archived),
      creator:profiles!placement_drives_created_by_fkey(display_name),
      publisher:profiles!placement_drives_published_by_fkey(display_name),
      closer:profiles!placement_drives_closed_by_fkey(display_name),
      archiver:profiles!placement_drives_archived_by_fkey(display_name)
    `
    )
    .eq("id", driveId)
    .single();

  if (driveErr || !drive) {
    notFound();
  }

  // 2. Fetch eligibility threshold row
  const { data: eligibility } = await supabase
    .from("drive_eligibility")
    .select("*")
    .eq("drive_id", driveId)
    .single();

  // 3. Fetch eligible batches
  const { data: batches } = await supabase
    .from("drive_eligible_batches")
    .select(
      `
      id,
      program_id,
      batch,
      program:academic_programs(id, code, display_name, degree_level)
    `
    )
    .eq("drive_id", driveId);

  // 4. Fetch available academic programs
  const { data: allPrograms } = await supabase
    .from("academic_programs")
    .select("id, code, display_name, degree_level, placement_eligible")
    .eq("is_active", true)
    .order("code", { ascending: true });

  // 5. Fetch recruiter drive access grants
  const { data: accessGrants } = await supabase
    .from("recruiter_drive_access")
    .select(
      `
      id,
      recruiter_profile_id,
      granted_at,
      expires_at,
      revoked_at,
      recruiter_profile:recruiter_profiles(
        id,
        profile_id,
        contact:recruiter_contacts(id, full_name, email, is_active)
      ),
      granter:profiles!recruiter_drive_access_granted_by_fkey(display_name),
      revoker:profiles!recruiter_drive_access_revoked_by_fkey(display_name)
    `
    )
    .eq("drive_id", driveId)
    .order("granted_at", { ascending: false });

  // 6. Fetch eligible recruiters (any active recruiter can be granted access by staff)
  const { data: companyRecruiters } = await supabase
    .from("recruiter_profiles")
    .select(
      `
      id,
      profile_id,
      contact:recruiter_contacts!inner(id, full_name, email, is_active)
    `
    );

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/drives"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  &larr; All Placement Drives
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Heading level={1} className="text-2xl font-bold">
                  {drive.title}
                </Heading>
                <Badge
                  variant={
                    drive.status === "PUBLISHED"
                      ? "success"
                      : drive.status === "CLOSED"
                        ? "warning"
                        : drive.status === "ARCHIVED"
                          ? "danger"
                          : "default"
                  }
                >
                  {drive.status}
                </Badge>
                <Badge
                  variant={
                    drive.drive_type === "PLACEMENT" ? "info" : "default"
                  }
                >
                  {drive.drive_type}
                </Badge>
              </div>
              <Text className="text-sm text-[var(--color-text-secondary)] mt-1">
                Company:{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {drive.company?.name || "Unknown Company"}
                </span>
                {drive.company?.is_archived && (
                  <span className="ml-2 text-red-500 font-bold text-xs uppercase">
                    (Company Archived)
                  </span>
                )}
              </Text>
            </div>
          </div>

          <StaffDriveDetailClient
            drive={drive}
            eligibility={eligibility}
            batches={batches || []}
            allPrograms={allPrograms || []}
            accessGrants={accessGrants || []}
            companyRecruiters={companyRecruiters || []}
            canPublishOrClose={canPublishOrClose}
            userRole={profile.role}
          />
        </div>
      </Container>
    </div>
  );
}

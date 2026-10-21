import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  StaffApplicationsClient,
  type StaffApplicationItem,
} from "@/app/staff/applications/StaffApplicationsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Drive Applications | Staff Portal",
  description: "View candidate applications submitted to this placement drive.",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StaffDriveApplicationsPage({
  params,
}: PageProps) {
  const { id: driveId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/drives/${driveId}/applications`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, coordinator_slot")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch drive details
  const { data: drive, error: driveErr } = await supabase
    .from("placement_drives")
    .select("id, title, drive_type, status")
    .eq("id", driveId)
    .single();

  if (driveErr || !drive) {
    notFound();
  }

  // Fetch applications for this drive
  const { data: applications = [] } = await supabase
    .from("v_staff_applications")
    .select("*")
    .eq("drive_id", driveId)
    .order("applied_at", { ascending: false });

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/staff/drives"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  &larr; Drives
                </Link>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  /
                </span>
                <Link
                  href={`/staff/drives/${driveId}`}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  {drive.title}
                </Link>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  /
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Applications
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Heading level={1} className="text-2xl sm:text-3xl">
                  {drive.title} — Candidates
                </Heading>
                <Badge
                  variant={
                    drive.drive_type === "PLACEMENT" ? "info" : "default"
                  }
                  size="sm"
                >
                  {drive.drive_type}
                </Badge>
                <Badge variant="info" size="sm">
                  {drive.status}
                </Badge>
              </div>
              <Text variant="secondary" className="text-sm">
                Candidates who applied to this drive within your assigned
                coordination scope.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/staff/drives/${driveId}`}>
                <Button variant="secondary" size="sm">
                  Drive Management &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <StaffApplicationsClient
            applications={(applications as StaffApplicationItem[]) || []}
            userRole={
              profile.role as
                "SUPER_ADMIN" | "TNP_SECRETARY" | "TNP_COORDINATOR"
            }
            currentDriveId={driveId}
            driveTitle={drive.title}
          />
        </div>
      </Container>
    </div>
  );
}

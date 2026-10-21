import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const instant = false;

export const metadata: Metadata = {
  title: "Drive Metadata & Requirements | Recruiter Portal",
  description: "Read-only view of authorized company placement drive.",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RecruiterDriveDetailPage({ params }: PageProps) {
  const { id: driveId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/recruiter/drives/${driveId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const isRecruiter =
    profile && profile.role === "RECRUITER" && profile.is_active;

  if (!isRecruiter) {
    redirect("/unauthorized");
  }

  // Fetch drive from safe granted drives view (RLS enforced)
  const { data: drive, error } = await supabase
    .from("v_recruiter_granted_drives")
    .select("*")
    .eq("id", driveId)
    .single();

  if (error || !drive) {
    notFound();
  }

  // Fetch configured criteria thresholds for recruiter reference
  const { data: criteria } = await supabase
    .from("drive_eligibility")
    .select("minimum_cgpa, maximum_active_backlogs, informational_requirements")
    .eq("drive_id", driveId)
    .single();

  // Fetch configured eligible cohorts
  const { data: eligibleBatches } = await supabase
    .from("drive_eligible_batches")
    .select(
      `
      program_id,
      batch,
      program:academic_programs(code, display_name, degree_level)
    `
    )
    .eq("drive_id", driveId);

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/recruiter/drives"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  &larr; Assigned Placement Drives
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Heading level={1} className="text-2xl font-bold">
                  {drive.title}
                </Heading>
                <Badge
                  variant={
                    drive.drive_type === "PLACEMENT" ? "info" : "default"
                  }
                >
                  {drive.drive_type}
                </Badge>
                <Badge variant={drive.is_open ? "success" : "warning"}>
                  {drive.is_open ? "OPEN" : "DEADLINE PASSED"}
                </Badge>
              </div>
              <Text className="text-sm text-[var(--color-text-secondary)] mt-1">
                Company:{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {drive.company_name}
                </span>
              </Text>
            </div>
          </div>

          {/* Recruiter Access Grant Notice */}
          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                Authorized Recruiter View
              </span>
              <p className="text-[var(--color-text-secondary)] mt-0.5">
                This is a read-only metadata projection. Candidate applications
                and candidate shortlisting workflows will be released in
                subsequent portal phases.
              </p>
            </div>

            {drive.expires_at && (
              <div className="text-right">
                <span className="text-[var(--color-text-secondary)] block">
                  Access Grant Valid Until:
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {new Date(drive.expires_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Drive Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Details & Description */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card className="p-6">
                <Heading level={2} className="text-lg font-bold mb-4">
                  Job Description &amp; Scope
                </Heading>
                {drive.description ? (
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {drive.description}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)] italic">
                    No detailed description provided.
                  </p>
                )}

                {drive.compensation_details && (
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                    <Heading level={3} className="text-sm font-semibold mb-2">
                      Compensation Details
                    </Heading>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      {drive.compensation_details}
                    </p>
                  </div>
                )}

                {drive.requirements_info && (
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                    <Heading level={3} className="text-sm font-semibold mb-2">
                      Requirements &amp; Instructions
                    </Heading>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      {drive.requirements_info}
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* Right 1 Col: Criteria & Targeting */}
            <div className="flex flex-col gap-6">
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-4">
                  Key Parameters
                </Heading>

                <div className="flex flex-col gap-3 text-sm">
                  {drive.location && (
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block">
                        Location
                      </span>
                      <span className="font-medium">{drive.location}</span>
                    </div>
                  )}

                  {drive.package_lpa !== null && (
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block">
                        Package (LPA CTC)
                      </span>
                      <span className="font-semibold text-lg text-green-600 dark:text-green-400">
                        {drive.package_lpa} LPA
                      </span>
                    </div>
                  )}

                  {drive.stipend_monthly !== null && (
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block">
                        Monthly Stipend
                      </span>
                      <span className="font-semibold text-lg text-green-600 dark:text-green-400">
                        ₹{drive.stipend_monthly.toLocaleString()} / mo
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Application Deadline
                    </span>
                    <span className="font-medium">
                      {drive.application_deadline
                        ? new Date(drive.application_deadline).toLocaleString()
                        : "No deadline specified"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Configured Thresholds Card */}
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-4">
                  Configured Criteria
                </Heading>

                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Minimum CGPA
                    </span>
                    <span className="font-semibold">
                      {criteria?.minimum_cgpa ?? 0.0}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Max Active Backlogs
                    </span>
                    <span className="font-semibold">
                      {criteria?.maximum_active_backlogs ?? 0}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)] block mb-1">
                      Target Cohorts
                    </span>
                    {eligibleBatches && eligibleBatches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {eligibleBatches.map((b) => (
                          <Badge
                            key={`${b.program_id}-${b.batch}`}
                            variant="default"
                          >
                            {b.program?.code} ({b.batch})
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">
                        No cohorts configured
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

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
  title: "Drive Details & Eligibility | Student Portal",
  description: "View drive criteria and authoritative eligibility evaluation.",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StudentDriveDetailPage({ params }: PageProps) {
  const { id: driveId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/student/drives/${driveId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  const isStudent = profile && profile.role === "STUDENT" && profile.is_active;

  if (!isStudent) {
    redirect("/unauthorized");
  }

  // 1. Fetch published drive from safe projection view
  const { data: drive, error } = await supabase
    .from("v_student_published_drives")
    .select("*")
    .eq("id", driveId)
    .single();

  if (error || !drive) {
    notFound();
  }

  // 2. Fetch authoritative eligibility assessment from RPC
  const { data: eligibilityData, error: eligError } = await supabase.rpc(
    "get_my_drive_eligibility",
    {
      p_drive_id: driveId,
    }
  );

  if (eligError) {
    console.error("Error evaluating student eligibility:", eligError);
  }

  const assessment = eligibilityData?.[0] || {
    academic_result: "UNDETERMINED",
    is_available: false,
    reason_codes: ["EVALUATION_ERROR"],
  };

  const { academic_result, is_available, reason_codes = [] } = assessment;

  // 3. Fetch public criteria thresholds & eligible cohorts for transparency
  const { data: criteria } = await supabase
    .from("drive_eligibility")
    .select("minimum_cgpa, maximum_active_backlogs, informational_requirements")
    .eq("drive_id", driveId)
    .single();

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

  // Helper to format reason code messages
  function getReasonExplanation(code: string): string {
    switch (code) {
      case "COURSE_NOT_ELIGIBLE":
        return "Your academic program is not targeted by this placement drive, or your degree is marked non-placement eligible.";
      case "BATCH_NOT_ELIGIBLE":
        return "Your graduating batch is not included in the eligible cohorts configured for this drive.";
      case "CGPA_BELOW_MINIMUM":
        return `Your verified CGPA is below the minimum threshold required (${criteria?.minimum_cgpa ?? "N/A"}).`;
      case "ACTIVE_BACKLOG_LIMIT_EXCEEDED":
        return `Your active backlog count exceeds the allowable limit (maximum ${criteria?.maximum_active_backlogs ?? 0}).`;
      case "PREVIOUSLY_SELECTED_PLACEMENT":
        return "Department One-Offer Policy: You have already been selected in a full-time placement drive.";
      case "DEADLINE_PASSED":
        return "The deadline to register for this drive has closed.";
      case "ACADEMIC_UNVERIFIED":
        return "Your academic profile is awaiting verification by the department coordinator.";
      case "ACADEMIC_DATA_UNAVAILABLE":
        return "Your academic profile records are incomplete or not yet submitted.";
      case "NOT_A_STUDENT":
        return "Your student lifecycle status is inactive or graduated.";
      default:
        return code;
    }
  }

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/student/drives"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  &larr; All Published Drives
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
                {drive.company_website && (
                  <a
                    href={drive.company_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    Website &rarr;
                  </a>
                )}
              </Text>
            </div>
          </div>

          {/* Authoritative Eligibility Banner */}
          <Card
            className={`p-6 border-2 ${
              academic_result === "PASS"
                ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                : academic_result === "FAIL"
                  ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
                  : "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Authoritative Eligibility Status
                  </span>
                  <Badge
                    variant={
                      academic_result === "PASS"
                        ? "success"
                        : academic_result === "FAIL"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {academic_result === "PASS"
                      ? "Eligible"
                      : academic_result === "FAIL"
                        ? "Not Eligible"
                        : "Eligibility Undetermined"}
                  </Badge>
                </div>

                {academic_result === "PASS" && (
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    You meet all academic criteria, program targeting, and batch
                    thresholds for this drive.
                  </p>
                )}

                {academic_result === "FAIL" && (
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                      You are not currently eligible for this drive due to the
                      following criteria:
                    </p>
                    <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-1">
                      {reason_codes
                        .filter((c: string) => c !== "ELIGIBLE")
                        .map((code: string) => (
                          <li key={code}>
                            <span className="font-semibold">{code}</span>:{" "}
                            {getReasonExplanation(code)}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {academic_result === "UNDETERMINED" && (
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                      Your eligibility status could not be verified
                      automatically:
                    </p>
                    <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 space-y-1 mb-2">
                      {reason_codes.map((code: string) => (
                        <li key={code}>
                          <span className="font-semibold">{code}</span>:{" "}
                          {getReasonExplanation(code)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Please ensure your academic record has been verified by
                      your department coordinator. Contact the TNP cell if you
                      believe this is an error.
                    </p>
                  </div>
                )}
              </div>

              {!is_available && (
                <div className="shrink-0 p-2 bg-red-100 dark:bg-red-900/40 rounded border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                  Applications are currently unavailable or deadline has passed.
                </div>
              )}
            </div>

            {/* Note: Phase 7 explicit constraint: NO Apply button */}
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>
                Eligibility is evaluated continuously on the database server.
                Candidate applications open in the upcoming phase.
              </span>
              <span className="font-semibold italic">
                Application Workflow: Phase 8 (Display Only in Phase 7)
              </span>
            </div>
          </Card>

          {/* Drive Details & Criteria Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Details & Description */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card className="p-6">
                <Heading level={2} className="text-lg font-bold mb-4">
                  Job Description &amp; Responsibilities
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
                      Compensation Breakdown &amp; Benefits
                    </Heading>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      {drive.compensation_details}
                    </p>
                  </div>
                )}

                {drive.requirements_info && (
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                    <Heading level={3} className="text-sm font-semibold mb-2">
                      Special Requirements &amp; Instructions
                    </Heading>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      {drive.requirements_info}
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* Right 1 Col: Key Metadata & Thresholds */}
            <div className="flex flex-col gap-6">
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-4">
                  Drive Snapshot
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
                        Package (CTC)
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
                    <span
                      className={`font-medium ${
                        !drive.is_open ? "text-red-500" : ""
                      }`}
                    >
                      {drive.application_deadline
                        ? new Date(drive.application_deadline).toLocaleString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "No deadline specified"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Threshold Criteria Card */}
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-4">
                  Eligibility Thresholds
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
                      Maximum Active Backlogs
                    </span>
                    <span className="font-semibold">
                      {criteria?.maximum_active_backlogs ?? 0}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)] block mb-1">
                      Eligible Cohorts
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
                        No batches configured
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

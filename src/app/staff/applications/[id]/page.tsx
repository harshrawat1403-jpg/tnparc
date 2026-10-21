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
import { Button } from "@/components/ui/Button";
import {
  StaffApplicationDetailClient,
  type StaffHistoryItem,
} from "./StaffApplicationDetailClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Application Review & Transition | Staff Portal",
  description:
    "Review student application snapshot, execute status transitions, and audit append-only history.",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StaffApplicationDetailPage({
  params,
}: PageProps) {
  const { id: applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/applications/${applicationId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, coordinator_slot")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // 1. Fetch application from safe scoped staff view
  const { data: application, error } = await supabase
    .from("v_staff_applications")
    .select("*")
    .eq("application_id", applicationId)
    .single();

  if (error || !application) {
    notFound();
  }

  // 2. Fetch full history ledger from safe view
  const { data: history = [] } = await supabase
    .from("v_staff_application_history")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "APPLIED":
        return <Badge variant="info">Applied</Badge>;
      case "SHORTLISTED":
        return <Badge variant="warning">Shortlisted</Badge>;
      case "INTERVIEW":
        return <Badge variant="info">Interview Scheduled</Badge>;
      case "SELECTED":
        return <Badge variant="success">Selected / Offered</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Not Selected</Badge>;
      case "WITHDRAWN":
        return <Badge variant="default">Withdrawn</Badge>;
      default:
        return <Badge variant="default">{status || "Unknown"}</Badge>;
    }
  };

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header & Breadcrumbs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/staff/applications"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  &larr; All Applications
                </Link>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  /
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {application.student_name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Heading level={1} className="text-2xl sm:text-3xl">
                  {application.student_name}
                </Heading>
                <Badge variant="default" size="sm">
                  {application.program_code} ({application.student_batch})
                </Badge>
                {getStatusBadge(application.application_status)}
              </div>
              <Text variant="secondary" className="text-sm">
                Candidate application for {application.drive_title} (
                {application.company_name})
              </Text>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/staff/students/${application.student_id}`}>
                <Button variant="secondary" size="sm">
                  Student Profile &rarr;
                </Button>
              </Link>
              <Link href={`/staff/drives/${application.drive_id}`}>
                <Button variant="secondary" size="sm">
                  Drive Details &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Status Machine Transitions & Append-Only History */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <StaffApplicationDetailClient
                applicationId={application.application_id!}
                currentStatus={application.application_status!}
                driveStatus={application.drive_status || ""}
                userRole={
                  profile.role as
                    "SUPER_ADMIN" | "TNP_SECRETARY" | "TNP_COORDINATOR"
                }
                historyEvents={(history as unknown as StaffHistoryItem[]) || []}
              />
            </div>

            {/* Right 1 Col: Snapshot & Drive Metadata */}
            <div className="flex flex-col gap-6">
              {/* Snapshot Metadata Card */}
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-4">
                  Authoritative Snapshot
                </Heading>
                <Text variant="secondary" className="text-xs mb-4">
                  Immutable academic metrics captured authoritatively from
                  academic records at submission time.
                </Text>

                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Snapshot CGPA
                    </span>
                    <span className="font-semibold text-lg text-[var(--color-text)]">
                      {application.snapshot_cgpa}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Active Backlogs
                    </span>
                    <span className="font-semibold text-lg text-[var(--color-text)]">
                      {application.snapshot_backlogs ?? 0}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Applied At
                    </span>
                    <span className="font-medium text-xs">
                      {application.applied_at
                        ? new Date(application.applied_at).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>

                  {application.application_deadline && (
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block">
                        Drive Deadline
                      </span>
                      <span className="font-medium text-xs">
                        {new Date(
                          application.application_deadline
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Target Drive Card */}
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-3">
                  Drive Summary
                </Heading>
                <div className="flex flex-col gap-2 text-xs">
                  <div>
                    <span className="text-[var(--color-text-secondary)] block">
                      Drive Title:
                    </span>
                    <span className="font-semibold text-sm">
                      {application.drive_title}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--color-text-secondary)] block">
                      Company:
                    </span>
                    <span className="font-medium">
                      {application.company_name}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--color-text-secondary)] block">
                      Drive Type:
                    </span>
                    <span className="font-medium">
                      {application.drive_type}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--color-text-secondary)] block">
                      Drive Status:
                    </span>
                    <Badge variant="default" size="sm">
                      {application.drive_status}
                    </Badge>
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

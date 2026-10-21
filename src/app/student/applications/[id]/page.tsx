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
import { StudentApplicationTimelineClient } from "./StudentApplicationTimelineClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Application Details & Timeline | Student Portal",
  description:
    "View application snapshot, stage progression, and timeline events.",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StudentApplicationDetailPage({
  params,
}: PageProps) {
  const { id: applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/student/applications/${applicationId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const isStudent = profile && profile.role === "STUDENT" && profile.is_active;

  if (!isStudent) {
    redirect("/unauthorized");
  }

  // 1. Fetch student application from safe view
  const { data: application, error } = await supabase
    .from("v_student_applications")
    .select("*")
    .eq("application_id", applicationId)
    .single();

  if (error || !application) {
    notFound();
  }

  // 2. Fetch sanitized student timeline events
  const { data: timelineEvents = [] } = await supabase
    .from("v_student_application_timeline")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  const getStatusBadge = (status: string) => {
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
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/student/applications"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  &larr; Back to Applications
                </Link>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  /
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {application.drive_title}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Heading level={1} className="text-2xl sm:text-3xl">
                  {application.drive_title}
                </Heading>
                <Badge
                  variant={
                    application.drive_type === "PLACEMENT" ? "info" : "default"
                  }
                  size="sm"
                >
                  {application.drive_type}
                </Badge>
                {getStatusBadge(application.application_status ?? "")}
              </div>
              <Text variant="secondary" className="text-sm">
                Company: {application.company_name || "N/A"}
              </Text>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/student/drives/${application.drive_id}`}>
                <Button variant="secondary" size="sm">
                  View Drive Details &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Timeline and Progression */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card className="p-6">
                <Heading level={2} className="text-lg font-bold mb-4">
                  Application Stage Timeline
                </Heading>
                <Text variant="secondary" className="text-xs mb-6">
                  Review the chronological progression of your application. All
                  milestones are recorded permanently in the append-only ledger.
                </Text>

                <StudentApplicationTimelineClient
                  applicationId={application.application_id!}
                  driveTitle={application.drive_title || "Placement Drive"}
                  canWithdraw={application.can_withdraw ?? false}
                  timelineEvents={
                    timelineEvents as {
                      id: string;
                      application_id: string;
                      previous_status:
                        | "APPLIED"
                        | "SHORTLISTED"
                        | "INTERVIEW"
                        | "SELECTED"
                        | "REJECTED"
                        | "WITHDRAWN"
                        | null;
                      new_status:
                        | "APPLIED"
                        | "SHORTLISTED"
                        | "INTERVIEW"
                        | "SELECTED"
                        | "REJECTED"
                        | "WITHDRAWN";
                      created_at: string;
                    }[]
                  }
                />
              </Card>
            </div>

            {/* Right 1 Col: Snapshot Data */}
            <div className="flex flex-col gap-6">
              <Card className="p-6">
                <Heading level={2} className="text-base font-bold mb-4">
                  Authoritative Snapshot
                </Heading>
                <Text variant="secondary" className="text-xs mb-4">
                  Captured authoritatively from your verified academic record at
                  the exact moment of submission.
                </Text>

                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Snapshot CGPA
                    </span>
                    <span className="font-semibold text-lg">
                      {application.snapshot_cgpa}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Active Backlogs at Submission
                    </span>
                    <span className="font-semibold text-lg">
                      {application.snapshot_backlogs ?? 0}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      Submission Timestamp
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
                        Drive Application Deadline
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
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const instant = false;

export const metadata: Metadata = {
  title: "My Applications | Student Portal",
  description: "View and track your placement and internship applications.",
};

export default async function StudentApplicationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/applications");
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

  // Fetch student applications from safe view
  const { data: applications = [] } = await supabase
    .from("v_student_applications")
    .select("*")
    .order("applied_at", { ascending: false });

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
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Student Portal
                </Badge>
                <Badge variant="info" size="sm">
                  My Applications
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                My Job &amp; Internship Applications
              </Heading>
              <Text variant="secondary" className="text-sm">
                Track status transitions, interview rounds, and audit histories.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/student/drives">
                <Button variant="primary" size="sm">
                  Explore Drives &rarr;
                </Button>
              </Link>
            </div>
          </div>

          {/* Applications Listing */}
          {applications && applications.length > 0 ? (
            <div className="flex flex-col gap-4">
              {applications.map((app) => (
                <Card key={app.application_id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold text-base text-[var(--color-text)]">
                          {app.drive_title}
                        </span>
                        <Badge
                          variant={
                            app.drive_type === "PLACEMENT" ? "info" : "default"
                          }
                          size="sm"
                        >
                          {app.drive_type}
                        </Badge>
                        {getStatusBadge(app.application_status ?? "")}
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[var(--color-text-secondary)]">
                        {app.company_name && (
                          <span className="font-medium text-[var(--color-text)]">
                            {app.company_name}
                          </span>
                        )}
                        <span>
                          Applied:{" "}
                          {app.applied_at
                            ? new Date(app.applied_at).toLocaleDateString()
                            : "N/A"}
                        </span>
                        <span>Authoritative CGPA: {app.snapshot_cgpa}</span>
                        <span>
                          Active Backlogs: {app.snapshot_backlogs ?? 0}
                        </span>
                        {app.application_deadline && (
                          <span>
                            Deadline:{" "}
                            {new Date(
                              app.application_deadline
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Link
                        href={`/student/applications/${app.application_id}`}
                      >
                        <Button variant="secondary" size="sm">
                          View Details &amp; Timeline &rarr;
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Heading level={2} className="text-lg font-bold mb-2">
                No Applications Submitted Yet
              </Heading>
              <Text
                variant="secondary"
                className="text-sm max-w-md mx-auto mb-6"
              >
                You have not submitted an application to any placement or
                internship drives. Browse active drives matching your academic
                standing to apply.
              </Text>
              <Link href="/student/drives">
                <Button variant="primary" size="md">
                  Browse Active Drives
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}

import React from "react";
import type { Metadata } from "next";
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
    "Student placement dashboard shell for verified departmental students.",
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    redirect("/unauthorized");
  }

  const { data: academic } = await supabase
    .from("academic_records")
    .select("batch, verification_status, program_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  const isGraduatedOrAlumni =
    profile.student_lifecycle_status === "STUDENT_GRADUATED" ||
    profile.student_lifecycle_status === "ALUMNI";

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Student Portal
                </Badge>
                <Badge
                  variant={isGraduatedOrAlumni ? "info" : "success"}
                  size="sm"
                >
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

            <form action={submitSignOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign Out
              </Button>
            </form>
          </div>

          {isGraduatedOrAlumni && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-[var(--radius-md)] text-sm text-amber-800 dark:text-amber-300">
              <strong>Notice:</strong> Your student account is marked as{" "}
              {profile.student_lifecycle_status}. Active placement drives are
              reserved for current batches. Your permanent academic and
              placement records remain archived.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card padding="md">
              <Heading level={3} className="text-base mb-1">
                Academic Program & Batch
              </Heading>
              <Text variant="secondary" className="text-xs mb-3">
                Authoritatively derived from departmental roster.
              </Text>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-[var(--color-text-secondary)]">
                    Batch:{" "}
                  </span>
                  <strong>{academic?.batch || "Pending"}</strong>
                </p>
                <p>
                  <span className="text-[var(--color-text-secondary)]">
                    Verification:{" "}
                  </span>
                  <Badge variant="default" size="sm">
                    {academic?.verification_status || "UNVERIFIED"}
                  </Badge>
                </p>
              </div>
            </Card>

            <Card padding="md">
              <Heading level={3} className="text-base mb-1">
                Phase 3 Security Shell
              </Heading>
              <Text variant="secondary" className="text-xs mb-3">
                Row Level Security and identity boundary verified.
              </Text>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Profile editing, resume upload, and portfolio settings are
                scheduled for Phase 4 per the frozen roadmap.
              </p>
            </Card>

            <Card padding="md">
              <Heading level={3} className="text-base mb-1">
                Account Status
              </Heading>
              <Text variant="secondary" className="text-xs mb-3">
                Session state and authorization.
              </Text>
              <div className="text-xs space-y-1 text-[var(--color-text-secondary)]">
                <p>
                  User ID:{" "}
                  <span className="font-mono">{user.id.slice(0, 8)}...</span>
                </p>
                <p>
                  Role:{" "}
                  <strong className="text-[var(--color-text)]">STUDENT</strong>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

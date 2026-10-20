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

export const instant = false;

export const metadata: Metadata = {
  title: "Academic Record",
  description:
    "Institutional academic performance, program, batch, and verification status.",
};

export default async function StudentAcademicPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/profile/academic");
  }

  // Verify caller profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // Fetch academic record with joined program details
  const { data: academic } = await supabase
    .from("academic_records")
    .select(
      "batch, cgpa, active_backlogs, verification_status, verified_at, academic_programs(display_name, code, degree_level, duration_years)"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const progData = academic?.academic_programs;
  const program = Array.isArray(progData) ? progData[0] : progData;

  const isVerified = academic?.verification_status === "VERIFIED";

  return (
    <div className="py-10">
      <Container size="md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/student/profile"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  &larr; Back to Professional Profile
                </Link>
                <Badge variant="default" size="sm">
                  {profile.student_lifecycle_status || "STUDENT_ACTIVE"}
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Academic Performance
              </Heading>
              <Text variant="secondary" className="text-sm">
                Protected institutional academic metrics and verification
                status.
              </Text>
            </div>

            <Link
              href="/student/dashboard"
              className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
            >
              Dashboard
            </Link>
          </div>

          <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-[var(--radius-md)] text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
            <strong>Protected Institutional Data:</strong> Academic records are
            maintained by authorized TNP staff. Contact the TNP office if you
            believe your record requires correction.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card padding="lg">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Program Information
              </p>
              <Heading level={3} className="text-lg mb-1">
                {program?.display_name || "Bachelor of Architecture"}
              </Heading>
              <div className="mt-3 space-y-1.5 text-sm text-[var(--color-text-secondary)]">
                <p>
                  Program Code:{" "}
                  <strong className="text-[var(--color-text)]">
                    {program?.code || "BARCH"}
                  </strong>
                </p>
                <p>
                  Degree Level:{" "}
                  <strong className="text-[var(--color-text)]">
                    {program?.degree_level || "UG"}
                  </strong>
                </p>
                <p>
                  Graduation Batch:{" "}
                  <strong className="text-[var(--color-text)]">
                    {academic?.batch || "N/A"}
                  </strong>
                </p>
                <p>
                  Duration:{" "}
                  <strong className="text-[var(--color-text)]">
                    {program?.duration_years || 5} Years
                  </strong>
                </p>
              </div>
            </Card>

            <Card padding="lg">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Verification & Standing
              </p>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={isVerified ? "success" : "default"} size="md">
                  {academic?.verification_status || "UNVERIFIED"}
                </Badge>
                {academic?.verified_at && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Verified on{" "}
                    {new Date(academic.verified_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)]">
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                    Cumulative CGPA
                  </p>
                  <p className="text-2xl font-bold">
                    {academic?.cgpa !== null && academic?.cgpa !== undefined
                      ? Number(academic.cgpa).toFixed(2)
                      : "—"}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    Out of 10.00
                  </p>
                </div>

                <div className="p-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-md)]">
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                    Active Backlogs
                  </p>
                  <p className="text-2xl font-bold">
                    {academic?.active_backlogs !== null &&
                    academic?.active_backlogs !== undefined
                      ? academic.active_backlogs
                      : "0"}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    Standing
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

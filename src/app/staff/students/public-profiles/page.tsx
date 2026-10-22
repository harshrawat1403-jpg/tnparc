import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import {
  PublicProfilesAuditClient,
  type StaffStudentPublicProfileRow,
} from "./PublicProfilesAuditClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Public Student Profiles Audit | Staff Portal",
  description:
    "Review student public showcase opt-ins, assigned slugs, and visibility settings across departmental cohorts.",
};

export default async function StaffPublicProfilesAuditPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/students/public-profiles");
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

  const isCoordinator = profile.role === "TNP_COORDINATOR";

  // Query scoped view v_staff_student_public_profiles
  const { data: rawStudents, error } = await supabase
    .from("v_staff_student_public_profiles")
    .select("*")
    .order("student_name", { ascending: true });

  const students =
    (rawStudents as unknown as StaffStudentPublicProfileRow[]) || [];

  // Query programs for filter dropdown
  const { data: programsData } = await supabase
    .from("academic_programs")
    .select("code, display_name")
    .eq("is_active", true)
    .order("code");

  const programs = (programsData || []).map((p) => ({
    code: p.code,
    name: p.display_name,
  }));

  return (
    <div className="py-10">
      <Container size="lg">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-xs text-[var(--color-text-secondary)]">
          <Link
            href="/staff/dashboard"
            className="text-[var(--color-primary)] hover:underline"
          >
            Dashboard
          </Link>
          <span>&rsaquo;</span>
          <Link
            href="/staff/students"
            className="text-[var(--color-primary)] hover:underline"
          >
            Students
          </Link>
          <span>&rsaquo;</span>
          <span className="font-medium text-[var(--color-text)]">
            Public Profiles Audit
          </span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <Heading level={1} className="text-2xl sm:text-3xl font-bold">
            Public Profiles Visibility Audit
          </Heading>
          <Text variant="secondary" className="text-sm">
            Monitor public showcase opt-ins, slug assignments, and portfolio
            links for students within your jurisdiction.
          </Text>
        </div>

        {error ? (
          <div className="p-4 rounded-[var(--radius-md)] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 text-sm">
            Failed to load public profile audit data: {error.message}
          </div>
        ) : (
          <PublicProfilesAuditClient
            students={students}
            programs={programs}
            isCoordinator={isCoordinator}
          />
        )}
      </Container>
    </div>
  );
}

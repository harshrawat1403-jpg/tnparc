import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GraduationManagementClient } from "./GraduationManagementClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Graduation & Alumni Transition | VNIT Staff",
  description:
    "Mark students as graduated and atomically transition graduated cohorts into permanent alumni profiles.",
};

export default async function GraduationManagementPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/alumni/graduation");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch active students and graduated students (respecting coordinator scope via RLS)
  const { data: studentsData } = await supabase
    .from("profiles")
    .select(
      `
      id,
      display_name,
      student_lifecycle_status,
      academic_records (
        batch,
        academic_programs (
          code,
          display_name
        )
      )
    `
    )
    .eq("role", "STUDENT")
    .eq("is_active", true)
    .in("student_lifecycle_status", ["STUDENT_ACTIVE", "STUDENT_GRADUATED"])
    .order("display_name", { ascending: true });

  const allStudents = (studentsData || []).map((s) => {
    const acRec = Array.isArray(s.academic_records)
      ? s.academic_records[0]
      : s.academic_records;
    const prog = acRec?.academic_programs as unknown as {
      code: string;
      display_name: string;
    } | null;
    return {
      id: s.id,
      display_name: s.display_name,
      student_lifecycle_status: s.student_lifecycle_status || "STUDENT_ACTIVE",
      program_code: prog?.code || "DEPT",
      program_name: prog?.display_name || "Department",
      batch: acRec?.batch || "—",
    };
  });

  const activeStudents = allStudents.filter(
    (s) => s.student_lifecycle_status === "STUDENT_ACTIVE"
  );
  const graduatedStudents = allStudents.filter(
    (s) => s.student_lifecycle_status === "STUDENT_GRADUATED"
  );

  // Fetch registered companies
  const { data: companiesData } = await supabase
    .from("companies")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  return (
    <div className="py-10">
      <Container size="lg">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-6 border-b border-[var(--color-border)] mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/staff/alumni"
                className="text-xs text-[var(--color-text-secondary)] hover:underline"
              >
                &larr; Back to Alumni Directory
              </Link>
            </div>
            <Heading
              level={1}
              className="text-2xl sm:text-3xl font-bold tracking-tight"
            >
              Student Graduation &amp; Alumni Transition
            </Heading>
            <Text variant="secondary" className="text-sm mt-1">
              Authoritative multi-step lifecycle progression preserving
              permanent identity and history.
            </Text>
          </div>
        </div>

        <GraduationManagementClient
          activeStudents={activeStudents}
          graduatedStudents={graduatedStudents}
          companies={companiesData || []}
        />
      </Container>
    </div>
  );
}

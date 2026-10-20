import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export const instant = false;

export const metadata: Metadata = {
  title: "Student Directory",
  description: "Browse students and access verified academic records.",
};

interface StaffStudentsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    program?: string;
    batch?: string;
    status?: string;
  }>;
}

export default async function StaffStudentsPage({
  searchParams,
}: StaffStudentsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize; // Fetch 21 items for lookahead pagination

  const supabase = await createClient();

  // Verify staff role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/students");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    viewerProfile &&
    viewerProfile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"].includes(
      viewerProfile.role
    );

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch active programs for filter dropdown
  const { data: programs } = await supabase
    .from("academic_programs")
    .select("id, code, display_name")
    .eq("is_active", true)
    .order("code");

  // Query students.
  // Coordinator scoping is strictly enforced at the database layer via RLS
  // on academic_records!inner (can_access_student) and student_profiles.
  let query = supabase
    .from("profiles")
    .select(
      `
      id,
      display_name,
      avatar_url,
      student_lifecycle_status,
      student_profiles (
        profile_completeness,
        phone
      ),
      academic_records!academic_records_profile_id_fkey!inner (
        program_id,
        batch,
        cgpa,
        active_backlogs,
        verification_status,
        academic_programs (
          id,
          code,
          display_name
        )
      )
    `
    )
    .eq("role", "STUDENT")
    .order("display_name", { ascending: true })
    .range(from, to);

  if (params.search?.trim()) {
    query = query.ilike("display_name", `%${params.search.trim()}%`);
  }

  if (params.program?.trim()) {
    query = query.eq("academic_records.program_id", params.program.trim());
  }

  if (params.batch?.trim()) {
    query = query.eq("academic_records.batch", params.batch.trim());
  }

  if (params.status?.trim()) {
    query = query.eq(
      "academic_records.verification_status",
      params.status.trim() as "UNVERIFIED" | "VERIFIED" | "CORRECTION_PENDING"
    );
  }

  const { data: rawStudents, error } = await query;

  const hasNextPage = (rawStudents?.length ?? 0) > pageSize;
  const students = rawStudents ? rawStudents.slice(0, pageSize) : [];
  const hasPrevPage = page > 1;

  function buildUrl(newPage: number) {
    const p = new URLSearchParams();
    if (newPage > 1) p.set("page", String(newPage));
    if (params.search) p.set("search", params.search);
    if (params.program) p.set("program", params.program);
    if (params.batch) p.set("batch", params.batch);
    if (params.status) p.set("status", params.status);
    const qs = p.toString();
    return `/staff/students${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Staff Operations
                </Badge>
                <Badge variant="warning" size="sm">
                  {viewerProfile.role}
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Student Directory
              </Heading>
              <Text variant="secondary" className="text-sm">
                Browse student profiles, check verification standings, and
                review academic records.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/staff/dashboard">
                <Button variant="secondary" size="sm">
                  Staff Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter Bar */}
          <Card padding="md" className="border-[var(--color-border)]">
            <form
              method="GET"
              action="/staff/students"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
              <div className="lg:col-span-1">
                <Input
                  label="Search Name"
                  name="search"
                  placeholder="e.g. Rahul Sharma"
                  defaultValue={params.search || ""}
                />
              </div>

              <div>
                <Select
                  label="Program"
                  name="program"
                  defaultValue={params.program || ""}
                >
                  <option value="">All Programs</option>
                  {programs?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.display_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Input
                  label="Batch"
                  name="batch"
                  placeholder="e.g. 2026"
                  defaultValue={params.batch || ""}
                />
              </div>

              <div>
                <Select
                  label="Verification Status"
                  name="status"
                  defaultValue={params.status || ""}
                >
                  <option value="">All Statuses</option>
                  <option value="UNVERIFIED">UNVERIFIED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="CORRECTION_PENDING">CORRECTION_PENDING</option>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">
                  Filter
                </Button>
                {(params.search ||
                  params.program ||
                  params.batch ||
                  params.status) && (
                  <Link href="/staff/students">
                    <Button type="button" variant="secondary">
                      Clear
                    </Button>
                  </Link>
                )}
              </div>
            </form>
          </Card>

          {/* Error notice if query failed */}
          {error && (
            <div
              role="alert"
              className="p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 rounded-[var(--radius-md)] border border-rose-200 dark:border-rose-900 text-sm"
            >
              Failed to load students: {error.message}
            </div>
          )}

          {/* Students Table */}
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full text-left text-sm divide-y divide-[var(--color-border)]">
              <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Program & Batch</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">CGPA</th>
                  <th className="py-3 px-4 text-right">Backlogs</th>
                  <th className="py-3 px-4 text-center">Completeness</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-[var(--color-text-secondary)] text-sm"
                    >
                      {viewerProfile.role === "TNP_COORDINATOR"
                        ? "No students found within your assigned coordinator scope."
                        : "No student records found matching the active filters."}
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const sp = Array.isArray(student.student_profiles)
                      ? student.student_profiles[0]
                      : student.student_profiles;
                    const ar = Array.isArray(student.academic_records)
                      ? student.academic_records[0]
                      : student.academic_records;
                    const prog = Array.isArray(ar?.academic_programs)
                      ? ar?.academic_programs[0]
                      : ar?.academic_programs;

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-[var(--color-surface-alt)]/50 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center font-medium text-xs text-[var(--color-text-primary)]">
                              {student.display_name?.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-[var(--color-text-primary)]">
                                {student.display_name}
                              </div>
                              {sp?.phone && (
                                <div className="text-xs text-[var(--color-text-secondary)]">
                                  {sp.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-secondary)] text-xs">
                          <div>{prog?.code || "—"}</div>
                          <div>Batch {ar?.batch || "—"}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {ar?.verification_status === "VERIFIED" ? (
                            <Badge variant="success" size="sm">
                              VERIFIED
                            </Badge>
                          ) : ar?.verification_status ===
                            "CORRECTION_PENDING" ? (
                            <Badge variant="info" size="sm">
                              CORRECTION_PENDING
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              UNVERIFIED
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-[var(--color-text-primary)]">
                          {ar?.cgpa !== null && ar?.cgpa !== undefined
                            ? Number(ar.cgpa).toFixed(2)
                            : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-[var(--color-text-primary)]">
                          {ar?.active_backlogs !== null &&
                          ar?.active_backlogs !== undefined
                            ? ar.active_backlogs
                            : "0"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono text-xs font-medium">
                            {sp?.profile_completeness ?? 0}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link href={`/staff/students/${student.id}`}>
                            <Button variant="secondary" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <Text variant="secondary" className="text-xs">
                Page {page} {hasNextPage && "— more records available"}
              </Text>
            </div>

            <div className="flex items-center gap-2">
              {hasPrevPage ? (
                <Link href={buildUrl(page - 1)}>
                  <Button variant="secondary" size="sm">
                    Previous
                  </Button>
                </Link>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  Previous
                </Button>
              )}

              {hasNextPage ? (
                <Link href={buildUrl(page + 1)}>
                  <Button variant="secondary" size="sm">
                    Next
                  </Button>
                </Link>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

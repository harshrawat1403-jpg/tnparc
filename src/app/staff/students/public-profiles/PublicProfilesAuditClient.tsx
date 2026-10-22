"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface StaffStudentPublicProfileRow {
  student_id: string;
  student_name: string;
  student_email: string | null;
  program_code: string;
  program_name: string;
  batch: string;
  student_lifecycle_status: string;
  public_profile_enabled: boolean;
  public_profile_slug: string | null;
  public_resume_enabled: boolean;
  public_portfolio_enabled: boolean;
  has_photo: boolean;
  public_headline: string | null;
  public_tagline: string | null;
  portfolio_url: string | null;
}

interface PublicProfilesAuditClientProps {
  students: StaffStudentPublicProfileRow[];
  programs: Array<{ code: string; name: string }>;
  isCoordinator: boolean;
}

export function PublicProfilesAuditClient({
  students,
  programs,
  isCoordinator,
}: PublicProfilesAuditClientProps) {
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [batchFilter, setBatchFilter] = useState("");

  // Unique batches in dataset
  const batches = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.batch) set.add(s.batch);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [students]);

  // Filtered students
  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = s.student_name.toLowerCase().includes(q);
        const matchesSlug = s.public_profile_slug?.toLowerCase().includes(q);
        const matchesEmail = s.student_email?.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesEmail) return false;
      }

      if (programFilter && s.program_code !== programFilter) {
        return false;
      }

      if (batchFilter && s.batch !== batchFilter) {
        return false;
      }

      if (statusFilter === "PUBLIC" && !s.public_profile_enabled) {
        return false;
      }

      if (statusFilter === "PRIVATE" && s.public_profile_enabled) {
        return false;
      }

      return true;
    });
  }, [students, search, programFilter, batchFilter, statusFilter]);

  const publicCount = useMemo(
    () => students.filter((s) => s.public_profile_enabled).length,
    [students]
  );

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <Card
        padding="md"
        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-[var(--color-text)]">
                Student Privacy & Public Directory Audit
              </span>
              <Badge variant="info" size="sm">
                {isCoordinator ? "Coordinator Scoped" : "Global Staff View"}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              This read-only audit log reflects students who have opted into the
              public talent showcase. Staff members cannot override student
              consent.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {publicCount} Public
            </span>
            <span className="px-2.5 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              {students.length - publicCount} Private
            </span>
          </div>
        </div>
      </Card>

      {/* Filter Controls */}
      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Search
            </label>
            <Input
              placeholder="Name, email, or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Public Visibility
            </label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Profiles ({students.length})</option>
              <option value="PUBLIC">
                Public Profiles Only ({publicCount})
              </option>
              <option value="PRIVATE">
                Private Only ({students.length - publicCount})
              </option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Academic Program
            </label>
            <Select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} &mdash; {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Graduation Batch
            </label>
            <Select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  Class of {b}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Audit Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase font-semibold">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Program & Batch</th>
                <th className="py-3 px-4">Public Status</th>
                <th className="py-3 px-4">Public Slug</th>
                <th className="py-3 px-4">Resume Ind.</th>
                <th className="py-3 px-4">Portfolio Link</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-[var(--color-text-secondary)]"
                  >
                    No student public profile records match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.student_id}
                    className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--color-text)]">
                        {s.student_name}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)]">
                        {s.student_email || "No email on roster"}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div>{s.program_code}</div>
                      <div className="text-[11px] text-[var(--color-text-secondary)]">
                        Class of {s.batch}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {s.public_profile_enabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-secondary)] text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Private
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {s.public_profile_slug ? (
                        <code className="text-[11px] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                          {s.public_profile_slug}
                        </code>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">
                          &mdash;
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {s.public_resume_enabled ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Yes
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">
                          No
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {s.public_portfolio_enabled && s.portfolio_url ? (
                        <span className="text-[var(--color-primary)] font-medium">
                          Enabled
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">
                          No
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {s.public_profile_enabled && s.public_profile_slug ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/students/profile/${s.public_profile_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span>View Showcase</span>
                            <span className="ml-1">&nearr;</span>
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/staff/students/${s.student_id}`}>
                            Staff Record
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

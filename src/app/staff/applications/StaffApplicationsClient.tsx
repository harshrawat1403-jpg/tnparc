"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ApplicationStatus } from "@/lib/actions/applications";

export interface StaffApplicationItem {
  application_id: string;
  student_id: string;
  student_name: string | null;
  program_id: string | null;
  program_code: string | null;
  program_name: string | null;
  student_batch: string | null;
  drive_id: string;
  drive_title: string | null;
  drive_type: "PLACEMENT" | "INTERNSHIP" | null;
  drive_status: string | null;
  application_deadline: string | null;
  company_id: string | null;
  company_name: string | null;
  application_status: ApplicationStatus | null;
  applied_at: string | null;
  snapshot_cgpa: number | null;
  snapshot_backlogs: number | null;
  updated_at: string | null;
}

interface StaffApplicationsClientProps {
  applications: StaffApplicationItem[];
  userRole?: "SUPER_ADMIN" | "TNP_SECRETARY" | "TNP_COORDINATOR";
  currentDriveId?: string;
  driveTitle?: string;
}

export function StaffApplicationsClient({
  applications,
  currentDriveId,
}: StaffApplicationsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (currentDriveId && app.drive_id !== currentDriveId) {
        return false;
      }

      if (statusFilter !== "ALL" && app.application_status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "ALL" && app.drive_type !== typeFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const sName = app.student_name?.toLowerCase() || "";
        const dTitle = app.drive_title?.toLowerCase() || "";
        const cName = app.company_name?.toLowerCase() || "";
        const pCode = app.program_code?.toLowerCase() || "";
        const batch = app.student_batch?.toLowerCase() || "";

        return (
          sName.includes(q) ||
          dTitle.includes(q) ||
          cName.includes(q) ||
          pCode.includes(q) ||
          batch.includes(q)
        );
      }

      return true;
    });
  }, [applications, currentDriveId, statusFilter, typeFilter, searchTerm]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "APPLIED":
        return <Badge variant="info">Applied</Badge>;
      case "SHORTLISTED":
        return <Badge variant="warning">Shortlisted</Badge>;
      case "INTERVIEW":
        return <Badge variant="info">Interview</Badge>;
      case "SELECTED":
        return <Badge variant="success">Selected</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      case "WITHDRAWN":
        return <Badge variant="default">Withdrawn</Badge>;
      default:
        return <Badge variant="default">{status || "Unknown"}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student, drive, company, or program/batch..."
              className="w-full text-sm p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPLIED">Applied</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="INTERVIEW">Interview</option>
                <option value="SELECTED">Selected</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </div>

            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-medium"
              >
                <option value="ALL">All Types</option>
                <option value="PLACEMENT">Placement</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Applications Table */}
      <Card className="overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)] uppercase">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Program / Batch</th>
                  <th className="py-3 px-4">Drive &amp; Company</th>
                  <th className="py-3 px-4">Snapshot Academics</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((app) => (
                  <tr
                    key={app.application_id}
                    className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-semibold block text-[var(--color-text)]">
                        {app.student_name || "Unknown Student"}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        ID: {app.student_id.slice(0, 8)}...
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium">
                        {app.program_code || "N/A"} (
                        {app.student_batch || "N/A"})
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium block text-[var(--color-text)]">
                        {app.drive_title}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {app.company_name} &bull; {app.drive_type}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <div>
                        <span className="font-semibold text-[var(--color-text)]">
                          CGPA: {app.snapshot_cgpa}
                        </span>
                      </div>
                      <div className="text-[var(--color-text-secondary)]">
                        Backlogs: {app.snapshot_backlogs ?? 0}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(app.application_status)}
                    </td>

                    <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                      {app.applied_at
                        ? new Date(app.applied_at).toLocaleDateString()
                        : "N/A"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Link href={`/staff/applications/${app.application_id}`}>
                        <Button variant="secondary" size="sm">
                          Review &rarr;
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">
            No applications found matching the selected filter criteria.
          </div>
        )}
      </Card>
    </div>
  );
}

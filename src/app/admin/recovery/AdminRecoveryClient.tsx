"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import {
  correctTerminalStatusAction,
  type ApplicationStatus,
} from "@/lib/actions/applications";
import type { StaffApplicationItem } from "@/app/staff/applications/StaffApplicationsClient";

interface AdminRecoveryClientProps {
  terminalApplications: StaffApplicationItem[];
}

export function AdminRecoveryClient({
  terminalApplications,
}: AdminRecoveryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected app for modal correction
  const [selectedApp, setSelectedApp] = useState<StaffApplicationItem | null>(
    null
  );
  const [correctionReason, setCorrectionReason] = useState("");

  const filtered = terminalApplications.filter((app) => {
    if (statusFilter !== "ALL" && app.application_status !== statusFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const sName = app.student_name?.toLowerCase() || "";
      const dTitle = app.drive_title?.toLowerCase() || "";
      const cName = app.company_name?.toLowerCase() || "";
      return sName.includes(q) || dTitle.includes(q) || cName.includes(q);
    }

    return true;
  });

  const handleExecuteCorrection = () => {
    if (!selectedApp) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanReason = correctionReason.trim();
    if (!cleanReason) {
      setErrorMsg("A mandatory non-empty justification reason is required.");
      return;
    }

    startTransition(async () => {
      const res = await correctTerminalStatusAction(
        selectedApp.application_id,
        cleanReason
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(
          res.success ||
            `Terminal status corrected to ${res.restoredStatus} for ${selectedApp.student_name}.`
        );
        setSelectedApp(null);
        setCorrectionReason("");
        router.refresh();
      }
    });
  };

  const getStatusBadge = (status: ApplicationStatus | null) => {
    switch (status) {
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
      {errorMsg && (
        <div className="p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
          {successMsg}
        </div>
      )}

      {/* Confirmation Dialog for Terminal Correction */}
      <ConfirmationDialog
        isOpen={selectedApp !== null}
        title={`Execute Terminal Correction: ${selectedApp?.student_name ?? ""}`}
        description={`Application for ${selectedApp?.drive_title ?? ""} (${selectedApp?.company_name ?? ""}) • Current Status: ${selectedApp?.application_status ?? ""}. Per system invariants, terminal correction derives the immediate prior non-terminal status from the permanent append-only ledger and restores it atomically with an immutable audit trail entry.`}
        variant="danger"
        confirmLabel="Confirm & Restore Prior Status"
        cancelLabel="Cancel"
        isPending={isPending}
        onConfirm={handleExecuteCorrection}
        onCancel={() => {
          setSelectedApp(null);
          setCorrectionReason("");
        }}
      >
        <div>
          <label
            htmlFor="recovery-reason"
            className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1"
          >
            Mandatory Justification Reason *
          </label>
          <textarea
            id="recovery-reason"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder="e.g. Company rescinded placement offer due to procedural discrepancy; restoring candidate to interview standing..."
            className="w-full text-xs p-2.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            rows={3}
            disabled={isPending}
          />
        </div>
      </ConfirmationDialog>

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by student, drive title, or company..."
              className="w-full text-sm p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] font-medium"
            >
              <option value="ALL">All Terminal Statuses</option>
              <option value="SELECTED">Selected Only</option>
              <option value="REJECTED">Rejected Only</option>
              <option value="WITHDRAWN">Withdrawn Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Terminal Applications Table */}
      <Card className="overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)] uppercase">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Program &amp; Cohort</th>
                  <th className="py-3 px-4">Placement Drive</th>
                  <th className="py-3 px-4">Terminal Status</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4 text-right">Recovery Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((app) => (
                  <tr
                    key={app.application_id}
                    className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-[var(--color-text)]">
                      {app.student_name}
                    </td>

                    <td className="py-3 px-4 text-xs font-medium">
                      {app.program_code} ({app.student_batch})
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium block text-[var(--color-text)]">
                        {app.drive_title}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {app.company_name} &bull; {app.drive_type}
                      </span>
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
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/staff/applications/${app.application_id}`}
                        >
                          <Button variant="secondary" size="sm">
                            Inspect &rarr;
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setCorrectionReason("");
                          }}
                        >
                          Correct Status
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">
            No terminal applications found matching your criteria.
          </div>
        )}
      </Card>
    </div>
  );
}

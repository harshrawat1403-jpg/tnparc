"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  applyToDriveAction,
  withdrawApplicationAction,
  type ApplicationStatus,
} from "@/lib/actions/applications";

interface StudentDriveApplicationCardProps {
  driveId: string;
  driveTitle: string;
  isOpen: boolean;
  academicResult: string; // 'PASS' | 'FAIL' | 'UNDETERMINED'
  isAvailable: boolean;
  reasonCodes?: string[];
  existingApplication?: {
    application_id: string | null;
    application_status: ApplicationStatus | null;
    applied_at: string | null;
    can_withdraw: boolean | null;
  } | null;
}

export function StudentDriveApplicationCard({
  driveId,
  driveTitle,
  isOpen,
  academicResult,
  isAvailable,
  existingApplication,
}: StudentDriveApplicationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  const handleApply = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await applyToDriveAction(driveId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Application submitted successfully.");
        router.refresh();
      }
    });
  };

  const handleWithdraw = () => {
    if (!existingApplication?.application_id) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await withdrawApplicationAction(
        existingApplication.application_id!,
        withdrawReason
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Application withdrawn.");
        setShowWithdrawConfirm(false);
        router.refresh();
      }
    });
  };

  const getStatusBadge = (status: ApplicationStatus) => {
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
    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
          {successMsg}
        </div>
      )}

      {existingApplication ? (
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                Your Application Status:
              </span>
              {getStatusBadge(existingApplication.application_status!)}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Applied on{" "}
              {existingApplication.applied_at
                ? new Date(existingApplication.applied_at).toLocaleString(
                    undefined,
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                : "N/A"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/student/applications/${existingApplication.application_id}`}
            >
              <Button variant="secondary" size="sm">
                View Timeline &amp; Details &rarr;
              </Button>
            </Link>

            {existingApplication.can_withdraw && !showWithdrawConfirm && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowWithdrawConfirm(true)}
                disabled={isPending}
              >
                Withdraw Application
              </Button>
            )}
          </div>

          {showWithdrawConfirm && (
            <div className="w-full mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                Confirm Withdrawal from {driveTitle}?
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                Withdrawal is permanent for this drive. Per policy, you will not
                be able to re-apply once withdrawn.
              </p>

              <div className="mb-3">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Optional Reason:
                </label>
                <input
                  type="text"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="e.g. Pursuing higher studies, personal reasons"
                  className="w-full text-xs p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  maxLength={200}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleWithdraw}
                  disabled={isPending}
                >
                  {isPending
                    ? "Withdrawing..."
                    : "Confirm Permanent Withdrawal"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowWithdrawConfirm(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {academicResult === "PASS" && isAvailable && isOpen ? (
              <p className="text-xs text-green-700 dark:text-green-300">
                You meet all authoritative academic criteria and cohort
                targeting for this drive.
              </p>
            ) : (
              <p className="text-xs text-red-600 dark:text-red-400">
                {!isOpen
                  ? "Applications for this drive are closed."
                  : !isAvailable
                    ? "Application deadline has passed or drive is not accepting applications."
                    : "You do not meet the minimum academic or cohort criteria to submit an application."}
              </p>
            )}
          </div>

          <div>
            <Button
              variant="primary"
              size="md"
              onClick={handleApply}
              disabled={
                isPending ||
                academicResult !== "PASS" ||
                !isAvailable ||
                !isOpen
              }
            >
              {isPending ? "Submitting Application..." : "Apply to Drive"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

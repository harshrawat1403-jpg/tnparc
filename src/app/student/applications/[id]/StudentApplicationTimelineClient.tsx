"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import {
  withdrawApplicationAction,
  type ApplicationStatus,
} from "@/lib/actions/applications";

interface TimelineEvent {
  id: string;
  application_id: string;
  previous_status: ApplicationStatus | null;
  new_status: ApplicationStatus;
  created_at: string;
}

interface StudentApplicationTimelineClientProps {
  applicationId: string;
  driveTitle: string;
  canWithdraw: boolean;
  timelineEvents: TimelineEvent[];
}

export function StudentApplicationTimelineClient({
  applicationId,
  driveTitle,
  canWithdraw,
  timelineEvents,
}: StudentApplicationTimelineClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  const handleWithdraw = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await withdrawApplicationAction(
        applicationId,
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

  const getStatusLabel = (status: ApplicationStatus) => {
    switch (status) {
      case "APPLIED":
        return "Application Submitted";
      case "SHORTLISTED":
        return "Shortlisted for Next Round";
      case "INTERVIEW":
        return "Interview Round Scheduled";
      case "SELECTED":
        return "Final Offer Extended";
      case "REJECTED":
        return "Application Not Selected";
      case "WITHDRAWN":
        return "Application Withdrawn by Candidate";
      default:
        return status;
    }
  };

  const getStatusBadge = (status: ApplicationStatus) => {
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
        return <Badge variant="default">{status}</Badge>;
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

      {/* Withdrawal Action Area */}
      {canWithdraw && (
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Withdraw Application
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                You may withdraw your application while it is still in APPLIED
                status prior to the application deadline.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowWithdrawConfirm(true)}
              disabled={isPending}
            >
              Withdraw Application
            </Button>
          </div>

          <ConfirmationDialog
            isOpen={showWithdrawConfirm}
            title="Confirm Permanent Application Withdrawal"
            description={`Are you sure you want to withdraw from ${driveTitle}? Per institutional policy, withdrawal is permanent and you will not be able to re-apply for this drive.`}
            variant="danger"
            confirmLabel="Confirm Permanent Withdrawal"
            cancelLabel="Keep Application"
            isPending={isPending}
            onConfirm={handleWithdraw}
            onCancel={() => setShowWithdrawConfirm(false)}
          >
            <div>
              <label
                htmlFor="withdraw-reason"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Optional Reason:
              </label>
              <input
                id="withdraw-reason"
                type="text"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="e.g. Preparing for GATE, personal reasons"
                className="w-full text-xs p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                maxLength={200}
                disabled={isPending}
              />
            </div>
          </ConfirmationDialog>
        </div>
      )}

      {/* Sanitized Stage Timeline */}
      <div className="relative pl-6 border-l-2 border-[var(--color-border)] space-y-6">
        {timelineEvents.map((evt) => (
          <div key={evt.id} className="relative group">
            {/* Timeline dot */}
            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-bg)]" />

            <div className="p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--color-text)]">
                    {getStatusLabel(evt.new_status)}
                  </span>
                  {getStatusBadge(evt.new_status)}
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {new Date(evt.created_at).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {evt.previous_status && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Transitioned from {evt.previous_status} to {evt.new_status}.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

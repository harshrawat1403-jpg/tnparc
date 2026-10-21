"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  transitionApplicationStatusAction,
  correctTerminalStatusAction,
  type ApplicationStatus,
} from "@/lib/actions/applications";

export interface StaffHistoryItem {
  id: string;
  application_id: string;
  previous_status: ApplicationStatus | null;
  new_status: ApplicationStatus;
  changed_by: string;
  changed_by_name: string | null;
  changed_by_role: string | null;
  reason: string | null;
  is_terminal_correction: boolean;
  created_at: string;
}

interface StaffApplicationDetailClientProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
  driveStatus: string;
  userRole: "SUPER_ADMIN" | "TNP_SECRETARY" | "TNP_COORDINATOR";
  historyEvents: StaffHistoryItem[];
}

export function StaffApplicationDetailClient({
  applicationId,
  currentStatus,
  driveStatus,
  userRole,
  historyEvents,
}: StaffApplicationDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Transition form state
  const [transitionReason, setTransitionReason] = useState("");

  // Terminal correction state
  const [correctionReason, setCorrectionReason] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const isTerminal = ["SELECTED", "REJECTED", "WITHDRAWN"].includes(
    currentStatus
  );
  const isArchived = driveStatus === "ARCHIVED";

  // Compute allowed transitions for current role & status
  const getAllowedTransitions = (): ApplicationStatus[] => {
    if (isTerminal || isArchived) return [];

    switch (currentStatus) {
      case "APPLIED":
        return ["SHORTLISTED", "REJECTED"];
      case "SHORTLISTED":
        if (["SUPER_ADMIN", "TNP_SECRETARY"].includes(userRole)) {
          return ["INTERVIEW", "REJECTED"];
        }
        return ["REJECTED"];
      case "INTERVIEW":
        if (["SUPER_ADMIN", "TNP_SECRETARY"].includes(userRole)) {
          return ["SELECTED", "REJECTED"];
        }
        return [];
      default:
        return [];
    }
  };

  const allowedTransitions = getAllowedTransitions();

  const handleTransition = (targetStatus: ApplicationStatus) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await transitionApplicationStatusAction(
        applicationId,
        targetStatus,
        transitionReason
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || `Status moved to ${targetStatus}.`);
        setTransitionReason("");
        router.refresh();
      }
    });
  };

  const handleTerminalCorrection = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!correctionReason.trim()) {
      setErrorMsg("A mandatory correction reason is required.");
      return;
    }
    startTransition(async () => {
      const res = await correctTerminalStatusAction(
        applicationId,
        correctionReason
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Terminal correction applied.");
        setCorrectionReason("");
        setShowCorrectionModal(false);
        router.refresh();
      }
    });
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

      {/* Workflow Controls Card */}
      <Card className="p-6">
        <h3 className="text-base font-bold text-[var(--color-text)] mb-3">
          Status Machine Actions
        </h3>

        {isArchived ? (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded text-xs text-amber-800 dark:text-amber-200">
            This drive is ARCHIVED. All application status transitions are
            permanently frozen.
          </div>
        ) : isTerminal ? (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              This application is in a terminal state (
              <span className="font-semibold">{currentStatus}</span>). Normal
              staff status transitions are prohibited per state machine rules.
            </div>

            {userRole === "SUPER_ADMIN" && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-red-800 dark:text-red-200">
                        Super Admin Terminal Correction
                      </span>
                      <Badge variant="danger" size="sm">
                        Recovery Mode
                      </Badge>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Authoritatively derive and restore the immediate prior
                      non-terminal status from the append-only ledger with
                      mandatory justification.
                    </p>
                  </div>

                  {!showCorrectionModal && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowCorrectionModal(true)}
                      disabled={isPending}
                    >
                      Correct Terminal Status
                    </Button>
                  )}
                </div>

                {showCorrectionModal && (
                  <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-900 flex flex-col gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                        Mandatory Correction Reason &amp; Procedural
                        Justification *
                      </label>
                      <textarea
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        placeholder="Explain why this terminal status is being corrected (e.g. Company rescinded offer due to procedural error, candidate withdrew mistakenly)..."
                        className="w-full text-xs p-2 rounded border border-red-300 dark:border-red-800 bg-[var(--color-bg)] text-[var(--color-text)]"
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleTerminalCorrection}
                        disabled={isPending || !correctionReason.trim()}
                      >
                        {isPending
                          ? "Applying Correction..."
                          : "Execute Authoritative Correction"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowCorrectionModal(false);
                          setCorrectionReason("");
                        }}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : allowedTransitions.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Optional transition reason or interview round notes..."
                  className="w-full text-xs p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                  maxLength={200}
                />
              </div>

              <div className="flex items-center gap-2">
                {allowedTransitions.map((target) => (
                  <Button
                    key={target}
                    variant={target === "REJECTED" ? "destructive" : "primary"}
                    size="sm"
                    onClick={() => handleTransition(target)}
                    disabled={isPending}
                  >
                    {isPending
                      ? "Updating..."
                      : target === "SHORTLISTED"
                        ? "Shortlist Candidate"
                        : target === "INTERVIEW"
                          ? "Move to Interview"
                          : target === "SELECTED"
                            ? "Extend Final Offer"
                            : "Reject Application"}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              Authorized transition pathways for {userRole}:{" "}
              {allowedTransitions.join(", ")}
            </p>
          </div>
        ) : (
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
            Your role ({userRole}) does not possess authority to transition
            applications from {currentStatus} status.
          </div>
        )}
      </Card>

      {/* Append-Only History Ledger */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)]">
              Append-Only Status History Ledger
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Permanent audit ledger with database-level immutability. UPDATE
              and DELETE are prohibited.
            </p>
          </div>
          <Badge variant="default" size="sm">
            {historyEvents.length} Events
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] uppercase">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Stage Transition</th>
                <th className="py-2.5 px-3">Actor / Role</th>
                <th className="py-2.5 px-3">Reason / Justification</th>
                <th className="py-2.5 px-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {historyEvents.map((evt) => (
                <tr
                  key={evt.id}
                  className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                >
                  <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">
                    {new Date(evt.created_at).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      {evt.previous_status ? (
                        <span>{evt.previous_status}</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)] italic">
                          Initial
                        </span>
                      )}
                      <span>&rarr;</span>
                      <span className="font-semibold text-[var(--color-text)]">
                        {evt.new_status}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span className="font-medium block text-[var(--color-text)]">
                      {evt.changed_by_name || "System"}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-secondary)]">
                      {evt.changed_by_role || "AUTOMATED"}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 max-w-xs truncate text-[var(--color-text)]">
                    {evt.reason || (
                      <span className="text-[var(--color-text-secondary)] italic">
                        No reason recorded
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-3">
                    {evt.is_terminal_correction ? (
                      <Badge variant="danger" size="sm">
                        Terminal Correction
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        Standard Event
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

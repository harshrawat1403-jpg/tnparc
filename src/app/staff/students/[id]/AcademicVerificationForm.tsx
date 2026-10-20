"use client";

import React, { useState, useTransition } from "react";
import {
  submitVerifyAcademic,
  submitCorrectAcademic,
} from "@/lib/actions/academic-verification";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { VerificationStatus } from "@/types/enums";

interface AcademicVerificationFormProps {
  targetProfileId: string;
  currentCgpa: number | null;
  currentActiveBacklogs: number | null;
  currentStatus: VerificationStatus;
}

export function AcademicVerificationForm({
  targetProfileId,
  currentCgpa,
  currentActiveBacklogs,
  currentStatus,
}: AcademicVerificationFormProps) {
  const [activeTab, setActiveTab] = useState<"verify" | "correct">("verify");
  const [isPending, startTransition] = useTransition();

  // Verification state
  const [verifyCgpa, setVerifyCgpa] = useState<string>(
    currentCgpa !== null && currentCgpa !== undefined ? String(currentCgpa) : ""
  );
  const [verifyBacklogs, setVerifyBacklogs] = useState<string>(
    currentActiveBacklogs !== null && currentActiveBacklogs !== undefined
      ? String(currentActiveBacklogs)
      : "0"
  );
  const [verifyFeedback, setVerifyFeedback] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  // Correction state
  const [correctCgpa, setCorrectCgpa] = useState<string>(
    currentCgpa !== null && currentCgpa !== undefined ? String(currentCgpa) : ""
  );
  const [correctBacklogs, setCorrectBacklogs] = useState<string>(
    currentActiveBacklogs !== null && currentActiveBacklogs !== undefined
      ? String(currentActiveBacklogs)
      : "0"
  );
  const [correctReason, setCorrectReason] = useState<string>("");
  const [correctFeedback, setCorrectFeedback] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyFeedback(null);

    const formData = new FormData();
    formData.append("targetProfileId", targetProfileId);
    formData.append("cgpa", verifyCgpa);
    formData.append("activeBacklogs", verifyBacklogs);

    startTransition(async () => {
      const res = await submitVerifyAcademic(null, formData);
      setVerifyFeedback(res);
    });
  };

  const handleCorrectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectFeedback(null);

    const formData = new FormData();
    formData.append("targetProfileId", targetProfileId);
    formData.append("cgpa", correctCgpa);
    formData.append("activeBacklogs", correctBacklogs);
    formData.append("reason", correctReason);

    startTransition(async () => {
      const res = await submitCorrectAcademic(null, formData);
      setCorrectFeedback(res);
      if (res.success) {
        setCorrectReason("");
      }
    });
  };

  return (
    <Card padding="lg" className="border-[var(--color-border)] shadow-sm">
      <div className="flex flex-col gap-6">
        <div>
          <Heading level={3} className="text-lg mb-1">
            Academic Verification & Correction
          </Heading>
          <Text variant="secondary" className="text-xs">
            Restricted to Super Admin & TNP Secretary. Current standing:{" "}
            <span className="font-semibold text-[var(--color-text-primary)]">
              {currentStatus}
            </span>
            . All actions are audited.
          </Text>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("verify")}
            className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${
              activeTab === "verify"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]"
            }`}
          >
            Verify Record
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("correct")}
            className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${
              activeTab === "correct"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]"
            }`}
          >
            Correct Record (Audited)
          </button>
        </div>

        {/* Verify Tab */}
        {activeTab === "verify" && (
          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-4">
            {verifyFeedback?.error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 rounded-[var(--radius-md)] border border-rose-200 dark:border-rose-900 text-xs"
              >
                {verifyFeedback.error}
              </div>
            )}
            {verifyFeedback?.success && (
              <div
                role="status"
                className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900 text-xs"
              >
                {verifyFeedback.success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Verified CGPA (0.00 – 10.00)"
                  type="number"
                  step="0.01"
                  min="0.00"
                  max="10.00"
                  required
                  value={verifyCgpa}
                  onChange={(e) => setVerifyCgpa(e.target.value)}
                  placeholder="e.g. 8.75"
                />
              </div>
              <div>
                <Input
                  label="Verified Active Backlogs"
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={verifyBacklogs}
                  onChange={(e) => setVerifyBacklogs(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending}
              >
                {isPending ? "Verifying..." : "Confirm & Verify Record"}
              </Button>
            </div>
          </form>
        )}

        {/* Correct Tab */}
        {activeTab === "correct" && (
          <form onSubmit={handleCorrectSubmit} className="flex flex-col gap-4">
            {correctFeedback?.error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 rounded-[var(--radius-md)] border border-rose-200 dark:border-rose-900 text-xs"
              >
                {correctFeedback.error}
              </div>
            )}
            {correctFeedback?.success && (
              <div
                role="status"
                className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900 text-xs"
              >
                {correctFeedback.success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Corrected CGPA (0.00 – 10.00)"
                  type="number"
                  step="0.01"
                  min="0.00"
                  max="10.00"
                  required
                  value={correctCgpa}
                  onChange={(e) => setCorrectCgpa(e.target.value)}
                  placeholder="e.g. 8.50"
                />
              </div>
              <div>
                <Input
                  label="Corrected Active Backlogs"
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={correctBacklogs}
                  onChange={(e) => setCorrectBacklogs(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>
            </div>

            <div>
              <Textarea
                label="Mandatory Justification Reason"
                rows={3}
                required
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                placeholder="State the authoritative basis for this correction (e.g. official grade card verification)."
                helperText="Must be at least 5 characters. Stored securely in the audit trail."
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending}
              >
                {isPending ? "Submitting..." : "Submit Audited Correction"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

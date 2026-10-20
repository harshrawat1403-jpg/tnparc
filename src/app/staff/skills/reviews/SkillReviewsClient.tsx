"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  submitVerifySkill,
  submitRejectSkill,
  getSkillEvidenceDownloadUrl,
} from "@/lib/actions/skills";

export interface SkillReviewRow {
  student_skill_id: string;
  student_id: string;
  student_name: string;
  program_name: string;
  program_code: string;
  batch: string;
  skill_id: string;
  skill_name: string;
  skill_category: string | null;
  proficiency_level: number;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
  is_active: boolean;
  claim_created_at: string;
  claim_updated_at: string;
  evidence_id: string | null;
  evidence_type: "PROJECT_LINK" | "PDF_DOCUMENT" | null;
  evidence_url: string | null;
  evidence_storage_path: string | null;
  evidence_description: string | null;
  evidence_submitted_at: string | null;
  verified_by: string | null;
  verifier_name: string | null;
  verified_at: string | null;
}

interface SkillReviewsClientProps {
  initialReviews: SkillReviewRow[];
  hasNextPage: boolean;
  currentPage: number;
  totalPrograms: { code: string; display_name: string }[];
  currentStatus: string;
  currentProgram: string;
  currentBatch: string;
  currentSearch: string;
}

const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
  4: "Expert",
};

export function SkillReviewsClient({
  initialReviews,
  hasNextPage,
  currentPage,
  totalPrograms,
  currentStatus,
  currentProgram,
  currentBatch,
  currentSearch,
}: SkillReviewsClientProps) {
  const [reviews, setReviews] = useState<SkillReviewRow[]>(initialReviews);
  const [statusFilter, setStatusFilter] = useState(currentStatus || "PENDING");
  const [programFilter, setProgramFilter] = useState(currentProgram || "ALL");
  const [batchFilter, setBatchFilter] = useState(currentBatch || "");
  const [search, setSearch] = useState(currentSearch || "");

  const [isPending, startTransition] = useTransition();

  // Reject Modal State
  const [rejectingItem, setRejectingItem] = useState<SkillReviewRow | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Evidence PDF loading state
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(
    null
  );

  const applyFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v && v !== "ALL") {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    });
    params.set("page", "1");
    window.location.search = params.toString();
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    window.location.search = params.toString();
  };

  const handleVerify = (item: SkillReviewRow) => {
    setActionError(null);
    startTransition(async () => {
      const res = await submitVerifySkill(item.student_skill_id);
      if (res.error) {
        setActionError(res.error);
      } else {
        setReviews((prev) =>
          prev.map((r) =>
            r.student_skill_id === item.student_skill_id
              ? { ...r, verification_status: "VERIFIED" }
              : r
          )
        );
      }
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    setActionError(null);

    startTransition(async () => {
      const res = await submitRejectSkill(
        rejectingItem.student_skill_id,
        rejectReason
      );
      if (res.error) {
        setActionError(res.error);
      } else {
        setReviews((prev) =>
          prev.map((r) =>
            r.student_skill_id === rejectingItem.student_skill_id
              ? { ...r, verification_status: "REJECTED" }
              : r
          )
        );
        setRejectingItem(null);
        setRejectReason("");
      }
    });
  };

  const handleViewPdf = async (evidenceId: string) => {
    setLoadingEvidenceId(evidenceId);
    try {
      const res = await getSkillEvidenceDownloadUrl(evidenceId);
      if (res.url) {
        window.open(res.url, "_blank");
      } else {
        alert(res.error || "Failed to load evidence file.");
      }
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {actionError && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded text-sm">
          {actionError}
        </div>
      )}

      {/* Filter Toolbar */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters({ status: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
              Academic Program
            </label>
            <select
              value={programFilter}
              onChange={(e) => {
                setProgramFilter(e.target.value);
                applyFilters({ program: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
            >
              <option value="ALL">All In-Scope Programs</option>
              {totalPrograms.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} ({p.display_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
              Batch Year
            </label>
            <Input
              placeholder="e.g. 2026"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters({ batch: batchFilter });
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
              Search
            </label>
            <Input
              placeholder="Student or skill name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyFilters({ search });
                }
              }}
            />
          </div>
        </div>
      </Card>

      {/* Review Queue Items */}
      {reviews.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No skill claims match the current review criteria.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((item) => (
            <Card key={item.student_skill_id} padding="md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Column: Student & Skill Detail */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base text-[var(--color-text-primary)]">
                      {item.student_name}
                    </span>
                    <Badge variant="default" size="sm">
                      {item.program_code} — Batch of {item.batch}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="font-medium text-sm text-[var(--color-primary)]">
                      {item.skill_name}
                    </span>
                    {item.skill_category && (
                      <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded">
                        {item.skill_category}
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Proficiency:{" "}
                      <strong>
                        {item.proficiency_level} / 4 (
                        {PROFICIENCY_LABELS[item.proficiency_level] || "N/A"})
                      </strong>
                    </span>
                  </div>

                  {/* Evidence Display */}
                  <div className="mt-3 text-xs bg-[var(--color-surface-hover)] p-3 rounded border border-[var(--color-border)]">
                    <span className="font-medium block mb-1 text-[var(--color-text-secondary)]">
                      Submitted Evidence:
                    </span>
                    {item.evidence_type === "PROJECT_LINK" &&
                      item.evidence_url && (
                        <div>
                          <a
                            href={item.evidence_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[var(--color-primary)] underline break-all font-medium"
                          >
                            🔗 {item.evidence_url}
                          </a>
                          {item.evidence_description && (
                            <p className="mt-1 text-[var(--color-text-secondary)] italic">
                              &ldquo;{item.evidence_description}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                    {item.evidence_type === "PDF_DOCUMENT" &&
                      item.evidence_storage_path && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleViewPdf(item.evidence_id!)}
                            disabled={loadingEvidenceId === item.evidence_id}
                          >
                            {loadingEvidenceId ===
                            (item.evidence_id || item.student_skill_id)
                              ? "Generating Link..."
                              : "📄 View PDF Evidence"}
                          </Button>
                          {item.evidence_description && (
                            <span className="text-[var(--color-text-secondary)] italic">
                              &ldquo;{item.evidence_description}&rdquo;
                            </span>
                          )}
                        </div>
                      )}

                    {!item.evidence_type && (
                      <span className="text-[var(--color-text-secondary)] italic">
                        No supporting evidence attached with this claim.
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Column: Status & Action Buttons */}
                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 min-w-[180px]">
                  <div>
                    <Badge
                      variant={
                        item.verification_status === "VERIFIED"
                          ? "success"
                          : item.verification_status === "REJECTED"
                            ? "danger"
                            : "warning"
                      }
                      size="sm"
                    >
                      {item.verification_status}
                    </Badge>
                  </div>

                  {item.verification_status === "PENDING" && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleVerify(item)}
                        disabled={isPending}
                        className="flex-1 md:flex-initial"
                      >
                        Verify
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRejectingItem(item);
                          setRejectReason("");
                        }}
                        disabled={isPending}
                        className="flex-1 md:flex-initial text-red-600 hover:text-red-700"
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {item.verification_status === "VERIFIED" &&
                    item.verifier_name && (
                      <div className="text-[11px] text-[var(--color-text-secondary)] text-right">
                        Verified by {item.verifier_name}
                        {item.verified_at && (
                          <div>
                            on {new Date(item.verified_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}

                  {item.verification_status === "REJECTED" && (
                    <div className="text-[11px] text-[var(--color-error)] text-right">
                      Claim rejected
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)] text-sm">
        <div>
          <span className="text-[var(--color-text-secondary)]">
            Page {currentPage}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
          >
            ← Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage || isPending}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2 text-[var(--color-text-primary)]">
              Reject Skill Claim: {rejectingItem.skill_name}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Student: {rejectingItem.student_name} (
              {rejectingItem.program_code})
            </p>

            <form onSubmit={handleRejectSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Feedback / Reason for Rejection (Optional)
                </label>
                <Textarea
                  placeholder="e.g. Please provide a verified portfolio link or certificate demonstrating advanced modeling proficiency."
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setRejectingItem(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isPending}
                >
                  {isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

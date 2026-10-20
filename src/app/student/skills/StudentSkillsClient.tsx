"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  submitClaimSkill,
  submitUpdateProficiency,
  submitArchiveSkill,
  submitResubmitSkill,
  submitSkillLinkEvidence,
  submitSkillPdfEvidence,
  getSkillEvidenceDownloadUrl,
} from "@/lib/actions/skills";

export interface CatalogSkill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

export interface StudentSkillClaim {
  id: string;
  skill_id: string;
  skill_name: string;
  skill_category: string | null;
  proficiency_level: number;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
  is_active: boolean;
  created_at: string;
  evidence: {
    id: string;
    evidence_type: "PROJECT_LINK" | "PDF_DOCUMENT";
    evidence_url: string | null;
    storage_path: string | null;
    description: string | null;
    submitted_at: string;
  } | null;
}

interface StudentSkillsClientProps {
  catalog: CatalogSkill[];
  claims: StudentSkillClaim[];
}

const PROFICIENCY_CONFIG: Record<
  number,
  { label: string; description: string }
> = {
  1: {
    label: "Beginner",
    description: "Foundational conceptual understanding / coursework",
  },
  2: {
    label: "Intermediate",
    description: "Practical project application / standard usage",
  },
  3: {
    label: "Advanced",
    description: "Independent complex modeling / high competence",
  },
  4: {
    label: "Expert",
    description: "Specialized production mastery / advanced techniques",
  },
};

export function StudentSkillsClient({
  catalog,
  claims,
}: StudentSkillsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Claim Skill Form State
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedProficiency, setSelectedProficiency] = useState(1);

  // Link Evidence Modal State
  const [linkModalSkillId, setLinkModalSkillId] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");

  // PDF Evidence Modal State
  const [pdfModalSkillId, setPdfModalSkillId] = useState<string | null>(null);
  const [pdfDescription, setPdfDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Loading signed URL state
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const activeClaimsCount = claims.length;
  const isCapReached = activeClaimsCount >= 15;

  // Filter out catalog skills that are already claimed
  const availableCatalog = catalog.filter(
    (catSkill) => !claims.some((c) => c.skill_id === catSkill.id)
  );

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("skillId", selectedSkillId);
    formData.append("proficiencyLevel", String(selectedProficiency));

    startTransition(async () => {
      const res = await submitClaimSkill(null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Skill claimed successfully.");
        setSelectedSkillId("");
        setSelectedProficiency(1);
        window.location.reload();
      }
    });
  };

  const handleProficiencyChange = (claimId: string, newLevel: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await submitUpdateProficiency(claimId, newLevel);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Proficiency updated.");
        window.location.reload();
      }
    });
  };

  const handleArchive = (claimId: string) => {
    if (
      !confirm(
        "Are you sure you want to archive this skill? It will no longer appear on your active profile, but can be reactivated later."
      )
    ) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await submitArchiveSkill(claimId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Skill archived.");
        window.location.reload();
      }
    });
  };

  const handleResubmit = (claimId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await submitResubmitSkill(claimId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Skill resubmitted for verification.");
        window.location.reload();
      }
    });
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkModalSkillId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("studentSkillId", linkModalSkillId);
    formData.append("evidenceUrl", evidenceUrl);
    formData.append("description", linkDescription);

    startTransition(async () => {
      const res = await submitSkillLinkEvidence(null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Project link evidence submitted.");
        setLinkModalSkillId(null);
        setEvidenceUrl("");
        setLinkDescription("");
        window.location.reload();
      }
    });
  };

  const handlePdfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfModalSkillId || !pdfFile) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("studentSkillId", pdfModalSkillId);
    formData.append("description", pdfDescription);
    formData.append("evidenceFile", pdfFile);

    startTransition(async () => {
      const res = await submitSkillPdfEvidence(formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "PDF evidence uploaded successfully.");
        setPdfModalSkillId(null);
        setPdfDescription("");
        setPdfFile(null);
        window.location.reload();
      }
    });
  };

  const handleViewPdf = async (evidenceId: string, claimId: string) => {
    setLoadingPdfId(claimId);
    try {
      const res = await getSkillEvidenceDownloadUrl(evidenceId);
      if (res.url) {
        window.open(res.url, "_blank");
      } else {
        alert(res.error || "Failed to load evidence file.");
      }
    } finally {
      setLoadingPdfId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Notices */}
      {errorMsg && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded text-sm">
          {successMsg}
        </div>
      )}

      {/* Advisory Banner & Active Claims Cap Counter */}
      <Card padding="md" className="border-l-4 border-l-[var(--color-primary)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-base mb-1 text-[var(--color-text-primary)]">
              Skill Claims: Advisory Signals
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
              Verified skills highlight your professional expertise to visiting
              recruiters. Skills are <strong>strictly advisory</strong> and{" "}
              <strong>do not</strong> impact your placement drive eligibility.
            </p>
          </div>

          <div className="text-right sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--color-border)]">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Active Claim Cap
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {activeClaimsCount}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                / 15
              </span>
              <Badge
                variant={
                  isCapReached
                    ? "danger"
                    : activeClaimsCount >= 10
                      ? "warning"
                      : "success"
                }
                size="sm"
              >
                {isCapReached
                  ? "Cap Reached"
                  : `${15 - activeClaimsCount} slots left`}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Add Skill Claim Section */}
      <Card padding="md">
        <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)]">
          Claim a Skill from the Catalog
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          Select an active departmental skill and declare your self-assessed
          proficiency level. You can attach project link or PDF evidence to
          facilitate review.
        </p>

        {isCapReached ? (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs">
            <strong>Limit Reached:</strong> You have reached the maximum cap of
            15 active skill claims. To claim a new skill, please archive one of
            your existing claims below.
          </div>
        ) : (
          <form
            onSubmit={handleClaimSubmit}
            className="flex flex-col md:flex-row gap-4 items-stretch md:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                Department Skill *
              </label>
              <select
                required
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                disabled={isPending}
              >
                <option value="">-- Choose a skill from catalog --</option>
                {availableCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.category ? `(${s.category})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-56">
              <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                Proficiency Level *
              </label>
              <select
                value={selectedProficiency}
                onChange={(e) =>
                  setSelectedProficiency(parseInt(e.target.value, 10))
                }
                className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                disabled={isPending}
              >
                <option value={1}>1 - Beginner (Foundational)</option>
                <option value={2}>2 - Intermediate (Practical)</option>
                <option value={3}>3 - Advanced (Complex Modeling)</option>
                <option value={4}>4 - Expert (Specialized Mastery)</option>
              </select>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending || !selectedSkillId}
                className="w-full md:w-auto"
              >
                {isPending ? "Claiming..." : "+ Claim Skill"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* My Claimed Skills List */}
      <div>
        <h3 className="font-semibold text-lg mb-3 text-[var(--color-text-primary)]">
          My Active Skills ({claims.length})
        </h3>

        {claims.length === 0 ? (
          <Card padding="lg" className="text-center py-12">
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              You have not claimed any skills yet.
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Use the catalog selector above to claim up to 15 relevant
              architectural and planning skills.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {claims.map((claim) => (
              <Card key={claim.id} padding="md">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Column: Skill Information */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-base text-[var(--color-text-primary)]">
                        {claim.skill_name}
                      </h4>
                      {claim.skill_category && (
                        <span className="text-xs bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded">
                          {claim.skill_category}
                        </span>
                      )}
                      <Badge
                        variant={
                          claim.verification_status === "VERIFIED"
                            ? "success"
                            : claim.verification_status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                        size="sm"
                      >
                        {claim.verification_status === "VERIFIED"
                          ? "✓ Verified"
                          : claim.verification_status === "REJECTED"
                            ? "✕ Rejected"
                            : "◷ Pending Verification"}
                      </Badge>
                    </div>

                    {/* Proficiency Selector / Display */}
                    <div className="mt-2 text-xs">
                      <span className="text-[var(--color-text-secondary)] mr-2">
                        Proficiency:
                      </span>
                      {claim.verification_status === "VERIFIED" ? (
                        <span className="font-medium text-[var(--color-text-primary)]">
                          Level {claim.proficiency_level} —{" "}
                          {PROFICIENCY_CONFIG[claim.proficiency_level]?.label} (
                          {
                            PROFICIENCY_CONFIG[claim.proficiency_level]
                              ?.description
                          }
                          )
                        </span>
                      ) : (
                        <select
                          value={claim.proficiency_level}
                          onChange={(e) =>
                            handleProficiencyChange(
                              claim.id,
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
                          disabled={isPending}
                        >
                          <option value={1}>Level 1 - Beginner</option>
                          <option value={2}>Level 2 - Intermediate</option>
                          <option value={3}>Level 3 - Advanced</option>
                          <option value={4}>Level 4 - Expert</option>
                        </select>
                      )}
                    </div>

                    {/* Evidence Attachment Status */}
                    <div className="mt-3 p-3 bg-[var(--color-surface-hover)] rounded border border-[var(--color-border)] text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[var(--color-text-secondary)]">
                          Supporting Evidence
                        </span>
                        {claim.verification_status !== "VERIFIED" && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setLinkModalSkillId(claim.id);
                                setEvidenceUrl(
                                  claim.evidence?.evidence_url || ""
                                );
                                setLinkDescription(
                                  claim.evidence?.description || ""
                                );
                              }}
                              className="text-[var(--color-primary)] hover:underline font-medium"
                              disabled={isPending}
                            >
                              + Link Evidence
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPdfModalSkillId(claim.id);
                                setPdfDescription(
                                  claim.evidence?.description || ""
                                );
                              }}
                              className="text-[var(--color-primary)] hover:underline font-medium"
                              disabled={isPending}
                            >
                              + PDF Evidence
                            </button>
                          </div>
                        )}
                      </div>

                      {claim.evidence ? (
                        <div>
                          {claim.evidence.evidence_type === "PROJECT_LINK" &&
                            claim.evidence.evidence_url && (
                              <div>
                                <a
                                  href={claim.evidence.evidence_url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-[var(--color-primary)] underline break-all font-medium"
                                >
                                  🔗 {claim.evidence.evidence_url}
                                </a>
                                {claim.evidence.description && (
                                  <p className="mt-1 text-[var(--color-text-secondary)] italic">
                                    &ldquo;{claim.evidence.description}&rdquo;
                                  </p>
                                )}
                              </div>
                            )}

                          {claim.evidence.evidence_type === "PDF_DOCUMENT" &&
                            claim.evidence.storage_path && (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    handleViewPdf(claim.evidence!.id, claim.id)
                                  }
                                  disabled={loadingPdfId === claim.id}
                                >
                                  {loadingPdfId === claim.id
                                    ? "Opening..."
                                    : "📄 View Uploaded PDF Evidence"}
                                </Button>
                                {claim.evidence.description && (
                                  <span className="text-[var(--color-text-secondary)] italic">
                                    &ldquo;{claim.evidence.description}&rdquo;
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      ) : (
                        <p className="text-[var(--color-text-secondary)] italic">
                          No evidence attached. Attaching project work or
                          certificates substantially helps staff verify your
                          skill.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-[var(--color-border)]">
                    {claim.verification_status === "REJECTED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleResubmit(claim.id)}
                        disabled={isPending || !claim.evidence}
                      >
                        Resubmit for Review
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleArchive(claim.id)}
                      disabled={isPending}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-red-600"
                    >
                      Archive Skill
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Project Link Evidence */}
      {linkModalSkillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2 text-[var(--color-text-primary)]">
              Submit Project Link Evidence
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Provide a verifiable external URL (e.g. GitHub repository, Behance
              portfolio, Figma project, or published report).
            </p>

            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Project Link URL *
                </label>
                <Input
                  required
                  type="url"
                  placeholder="https://..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Brief Context / Description (Optional)
                </label>
                <Textarea
                  placeholder="Explain your contribution or highlight key aspects..."
                  rows={3}
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLinkModalSkillId(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending || !evidenceUrl.trim()}
                >
                  {isPending ? "Submitting..." : "Submit Evidence"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: PDF Document Evidence */}
      {pdfModalSkillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2 text-[var(--color-text-primary)]">
              Upload PDF Evidence Document
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Upload a certificate, sheet, or report demonstrating proficiency.
              Must be a valid PDF document under 5 MB.
            </p>

            <form onSubmit={handlePdfSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  PDF Document (Max 5 MB) *
                </label>
                <input
                  required
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPdfFile(f);
                  }}
                  className="w-full text-xs text-[var(--color-text-secondary)] file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-hover)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-border)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Brief Context / Description (Optional)
                </label>
                <Textarea
                  placeholder="e.g. Course completion certificate with distinction, Studio project 4 sheet..."
                  rows={3}
                  value={pdfDescription}
                  onChange={(e) => setPdfDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPdfModalSkillId(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending || !pdfFile}
                >
                  {isPending ? "Uploading..." : "Upload Evidence"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

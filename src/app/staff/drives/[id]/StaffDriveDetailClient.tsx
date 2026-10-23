"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitUpdateDrive,
  submitConfigureEligibility,
  submitConfigureEligibleBatches,
  submitPublishDrive,
  submitCloseDrive,
  submitArchiveDrive,
  submitGrantRecruiterAccess,
  submitRevokeRecruiterAccess,
  submitCorrectPublishedDrive,
} from "@/lib/actions/drives";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/ui/Text";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

interface AcademicProgramRecord {
  id: string;
  code: string;
  display_name: string;
  degree_level: string;
  placement_eligible: boolean;
}

interface BatchRecord {
  id: string;
  program_id: string;
  batch: string;
  program?: {
    id: string;
    code: string;
    display_name: string;
    degree_level: string;
  } | null;
}

interface RecruiterAccessRecord {
  id: string;
  recruiter_profile_id: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  recruiter_profile?: {
    id: string;
    profile_id: string;
    contact?: {
      id: string;
      full_name: string;
      email: string;
      is_active: boolean;
    } | null;
  } | null;
  granter?: { display_name: string | null } | null;
  revoker?: { display_name: string | null } | null;
}

interface CompanyRecruiterOption {
  id: string;
  profile_id: string;
  contact: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
  };
}

interface DriveDetailProps {
  drive: {
    id: string;
    company_id: string;
    title: string;
    drive_type: "PLACEMENT" | "INTERNSHIP";
    status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
    description: string | null;
    location: string | null;
    application_deadline: string | null;
    package_lpa: number | null;
    stipend_monthly: number | null;
    compensation_details: string | null;
    requirements_info: string | null;
    created_at: string;
    published_at: string | null;
    closed_at: string | null;
    archived_at: string | null;
    company?: {
      id: string;
      name: string;
      website: string | null;
      is_archived: boolean;
    } | null;
    creator?: { display_name: string | null } | null;
    publisher?: { display_name: string | null } | null;
    closer?: { display_name: string | null } | null;
    archiver?: { display_name: string | null } | null;
  };
  eligibility: {
    minimum_cgpa: number;
    maximum_active_backlogs: number;
    exclude_previously_selected_placement: boolean;
    informational_requirements: string | null;
  } | null;
  batches: BatchRecord[];
  allPrograms: AcademicProgramRecord[];
  accessGrants: RecruiterAccessRecord[];
  companyRecruiters: CompanyRecruiterOption[];
  canPublishOrClose: boolean;
  userRole: string;
}

export function StaffDriveDetailClient({
  drive,
  eligibility,
  batches,
  allPrograms,
  accessGrants,
  companyRecruiters,
  canPublishOrClose,
}: DriveDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "eligibility" | "cohorts" | "recruiters"
  >("overview");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cohort state management
  const [selectedCohorts, setSelectedCohorts] = useState<
    Array<{ program_id: string; batch: string }>
  >(
    batches.map((b) => ({
      program_id: b.program_id,
      batch: b.batch,
    }))
  );
  const [newCohortProgram, setNewCohortProgram] = useState<string>("");
  const [newCohortBatch, setNewCohortBatch] = useState<string>("");

  // Recruiter access grant form
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>("");
  const [grantExpiresAt, setGrantExpiresAt] = useState<string>("");
  const [now] = useState(() => Date.now());
  const [confirmAction, setConfirmAction] = useState<
    "publish" | "close" | "archive" | { type: "revoke"; grantId: string } | null
  >(null);

  // Audited published drive correction state
  const [isCorrectDialogOpen, setIsCorrectDialogOpen] = useState(false);
  const [correctReason, setCorrectReason] = useState("");
  const [correctTitle, setCorrectTitle] = useState(drive.title);
  const [correctDeadline, setCorrectDeadline] = useState(
    drive.application_deadline ? drive.application_deadline.slice(0, 16) : ""
  );
  const [correctDescription, setCorrectDescription] = useState(
    drive.description || ""
  );
  const [correctLocation, setCorrectLocation] = useState(drive.location || "");
  const [correctPackage, setCorrectPackage] = useState(
    drive.package_lpa !== null && drive.package_lpa !== undefined
      ? drive.package_lpa.toString()
      : ""
  );
  const [correctStipend, setCorrectStipend] = useState(
    drive.stipend_monthly !== null && drive.stipend_monthly !== undefined
      ? drive.stipend_monthly.toString()
      : ""
  );
  const [correctCompensation, setCorrectCompensation] = useState(
    drive.compensation_details || ""
  );
  const [correctRequirements, setCorrectRequirements] = useState(
    drive.requirements_info || ""
  );

  const isDraft = drive.status === "DRAFT";
  const isPublished = drive.status === "PUBLISHED";
  const isClosed = drive.status === "CLOSED";
  const isArchived = drive.status === "ARCHIVED";

  function clearMessages() {
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  // --- Lifecycle Action Handlers ---
  function handlePublish() {
    clearMessages();
    startTransition(async () => {
      const res = await submitPublishDrive(drive.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Drive published successfully.");
        router.refresh();
      }
    });
  }

  function handleClose() {
    clearMessages();
    startTransition(async () => {
      const res = await submitCloseDrive(drive.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Drive closed successfully.");
        router.refresh();
      }
    });
  }

  function handleArchive() {
    clearMessages();
    startTransition(async () => {
      const res = await submitArchiveDrive(drive.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Drive archived successfully.");
        router.refresh();
      }
    });
  }

  function handleCorrectPublishedDrive() {
    if (!correctReason.trim() || correctReason.trim().length < 5) {
      setErrorMsg(
        "A detailed correction reason (min 5 characters) is required."
      );
      return;
    }
    clearMessages();
    startTransition(async () => {
      const res = await submitCorrectPublishedDrive(drive.id, correctReason, {
        title: correctTitle,
        description: correctDescription,
        location: correctLocation,
        applicationDeadline: correctDeadline
          ? new Date(correctDeadline).toISOString()
          : undefined,
        packageLpa: correctPackage ? parseFloat(correctPackage) : undefined,
        stipendMonthly: correctStipend ? parseFloat(correctStipend) : undefined,
        compensationDetails: correctCompensation,
        requirementsInfo: correctRequirements,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Published drive corrected successfully.");
        setIsCorrectDialogOpen(false);
        router.refresh();
      }
    });
  }

  // --- Drive Details Form Handler ---
  async function handleUpdateDetails(formData: FormData) {
    clearMessages();
    startTransition(async () => {
      const res = await submitUpdateDrive(drive.id, null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Drive details updated.");
        router.refresh();
      }
    });
  }

  // --- Eligibility Criteria Form Handler ---
  async function handleUpdateEligibility(formData: FormData) {
    clearMessages();
    startTransition(async () => {
      const res = await submitConfigureEligibility(drive.id, null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Eligibility criteria configured.");
        router.refresh();
      }
    });
  }

  // --- Cohorts Handlers ---
  function addCohort() {
    if (!newCohortProgram || !newCohortBatch.trim()) {
      setErrorMsg("Please select an academic program and enter a valid batch.");
      return;
    }
    const cleanBatch = newCohortBatch.trim();
    if (
      selectedCohorts.some(
        (c) => c.program_id === newCohortProgram && c.batch === cleanBatch
      )
    ) {
      setErrorMsg("This program and batch cohort is already added.");
      return;
    }
    setSelectedCohorts([
      ...selectedCohorts,
      { program_id: newCohortProgram, batch: cleanBatch },
    ]);
    setNewCohortProgram("");
    setNewCohortBatch("");
    setErrorMsg(null);
  }

  function removeCohort(index: number) {
    setSelectedCohorts(selectedCohorts.filter((_, i) => i !== index));
  }

  function saveCohorts() {
    clearMessages();
    if (selectedCohorts.length === 0) {
      setErrorMsg("At least one eligible cohort is required.");
      return;
    }
    startTransition(async () => {
      const res = await submitConfigureEligibleBatches(
        drive.id,
        selectedCohorts
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Cohorts updated successfully.");
        router.refresh();
      }
    });
  }

  // --- Recruiter Access Handlers ---
  function handleGrantRecruiterAccess() {
    clearMessages();
    if (!selectedRecruiter) {
      setErrorMsg("Please select a recruiter to grant drive access.");
      return;
    }
    startTransition(async () => {
      const res = await submitGrantRecruiterAccess(
        drive.id,
        selectedRecruiter,
        grantExpiresAt || undefined
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Recruiter access granted.");
        setSelectedRecruiter("");
        setGrantExpiresAt("");
        router.refresh();
      }
    });
  }

  function handleRevokeAccess(grantId: string) {
    clearMessages();
    startTransition(async () => {
      const res = await submitRevokeRecruiterAccess(drive.id, grantId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.success || "Recruiter access revoked.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg text-sm text-green-600 dark:text-green-400">
          {successMsg}
        </div>
      )}

      {/* Lifecycle Action Bar */}
      <Card className="p-4 bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">Current State:</span>
            <Badge
              variant={
                isPublished
                  ? "success"
                  : isClosed
                    ? "warning"
                    : isArchived
                      ? "danger"
                      : "default"
              }
            >
              {drive.status}
            </Badge>
            {drive.published_at && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                Published: {new Date(drive.published_at).toLocaleDateString()}{" "}
                {drive.publisher?.display_name &&
                  `by ${drive.publisher.display_name}`}
              </span>
            )}
            {drive.closed_at && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                Closed: {new Date(drive.closed_at).toLocaleDateString()}{" "}
                {drive.closer?.display_name &&
                  `by ${drive.closer.display_name}`}
              </span>
            )}
            {drive.archived_at && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                Archived: {new Date(drive.archived_at).toLocaleDateString()}{" "}
                {drive.archiver?.display_name &&
                  `by ${drive.archiver.display_name}`}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canPublishOrClose && isDraft && (
              <Button
                variant="primary"
                onClick={() => setConfirmAction("publish")}
                disabled={isPending}
              >
                {isPending ? "Publishing..." : "Publish Drive"}
              </Button>
            )}

            {canPublishOrClose && isPublished && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsCorrectDialogOpen(true)}
                  disabled={isPending}
                >
                  Correct Published Drive
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmAction("close")}
                  disabled={isPending}
                >
                  {isPending ? "Closing..." : "Close Drive"}
                </Button>
              </>
            )}

            {canPublishOrClose && isClosed && (
              <Button
                variant="destructive"
                onClick={() => setConfirmAction("archive")}
                disabled={isPending}
              >
                {isPending ? "Archiving..." : "Archive Drive"}
              </Button>
            )}

            {isArchived && (
              <span className="text-xs text-[var(--color-text-secondary)] italic">
                Terminal state (Archived). No further transitions permitted.
              </span>
            )}
          </div>
        </div>
      </Card>

      <ConfirmationDialog
        isOpen={confirmAction !== null}
        title={
          confirmAction === "publish"
            ? "Confirm Drive Publication"
            : confirmAction === "close"
              ? "Confirm Drive Closure"
              : confirmAction === "archive"
                ? "Confirm Drive Archival"
                : "Confirm Revoke Recruiter Access"
        }
        description={
          confirmAction === "publish"
            ? "Publishing this drive makes it immediately visible to all eligible students and begins accepting applications. Core eligibility parameters cannot be reduced afterwards."
            : confirmAction === "close"
              ? "Closing this drive prevents new student applications from being submitted. Existing applications will remain for processing."
              : confirmAction === "archive"
                ? "Archiving this drive is permanent. All application workflows will be frozen and no further modifications will be allowed."
                : "Are you sure you want to revoke this recruiter's drive access immediately? They will no longer be able to view applicants."
        }
        variant={
          confirmAction === "publish"
            ? "primary"
            : confirmAction === "close"
              ? "warning"
              : "danger"
        }
        confirmLabel={
          confirmAction === "publish"
            ? "Publish Drive"
            : confirmAction === "close"
              ? "Close Drive"
              : confirmAction === "archive"
                ? "Archive Drive Permanently"
                : "Revoke Access"
        }
        cancelLabel="Cancel"
        isPending={isPending}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction === "publish") {
            setConfirmAction(null);
            handlePublish();
          } else if (confirmAction === "close") {
            setConfirmAction(null);
            handleClose();
          } else if (confirmAction === "archive") {
            setConfirmAction(null);
            handleArchive();
          } else if (
            typeof confirmAction === "object" &&
            confirmAction.type === "revoke"
          ) {
            const gid = confirmAction.grantId;
            setConfirmAction(null);
            handleRevokeAccess(gid);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmationDialog
        isOpen={isCorrectDialogOpen}
        title="Correct Published Drive"
        description="This performs an audited administrative correction to an active, published drive. Company and drive type remain immutable. Existing student applications, eligibility checks, and evaluation history are preserved. A detailed audit reason is mandatory."
        confirmLabel="Apply Audited Correction"
        cancelLabel="Cancel"
        variant="warning"
        isPending={isPending}
        onConfirm={handleCorrectPublishedDrive}
        onCancel={() => setIsCorrectDialogOpen(false)}
      >
        <div className="space-y-3 mt-3 text-left">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Correction Audit Reason (Mandatory, min 5 chars)
            </label>
            <Textarea
              value={correctReason}
              onChange={(e) => setCorrectReason(e.target.value)}
              placeholder="State why this published drive is being corrected (e.g., Extended deadline per recruiter request)..."
              rows={2}
              className="text-xs"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Drive Title
              </label>
              <Input
                value={correctTitle}
                onChange={(e) => setCorrectTitle(e.target.value)}
                className="text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Application Deadline
              </label>
              <Input
                type="datetime-local"
                value={correctDeadline}
                onChange={(e) => setCorrectDeadline(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Location
              </label>
              <Input
                value={correctLocation}
                onChange={(e) => setCorrectLocation(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Package LPA
              </label>
              <Input
                type="number"
                step="0.01"
                value={correctPackage}
                onChange={(e) => setCorrectPackage(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Role Description
            </label>
            <Textarea
              value={correctDescription}
              onChange={(e) => setCorrectDescription(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Stipend Monthly
              </label>
              <Input
                type="number"
                step="0.01"
                value={correctStipend}
                onChange={(e) => setCorrectStipend(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Compensation Details
              </label>
              <Input
                value={correctCompensation}
                onChange={(e) => setCorrectCompensation(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Requirements Info
            </label>
            <Textarea
              value={correctRequirements}
              onChange={(e) => setCorrectRequirements(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>
      </ConfirmationDialog>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "overview"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Overview &amp; Details
        </button>
        <button
          onClick={() => setActiveTab("eligibility")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "eligibility"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Eligibility Criteria
        </button>
        <button
          onClick={() => setActiveTab("cohorts")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "cohorts"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Target Batches ({selectedCohorts.length})
        </button>
        <button
          onClick={() => setActiveTab("recruiters")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "recruiters"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Recruiter Access ({accessGrants.filter((g) => !g.revoked_at).length})
        </button>
      </div>

      {/* Tab 1: Overview & Details */}
      {activeTab === "overview" && (
        <Card className="p-6">
          <form action={handleUpdateDetails} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Drive Title <span className="text-red-500">*</span>
              </label>
              <Input
                name="title"
                defaultValue={drive.title}
                required
                maxLength={200}
                disabled={!isDraft || isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Drive Type
                </label>
                <Input
                  value={
                    drive.drive_type === "PLACEMENT"
                      ? "Full-Time Placement"
                      : "Internship"
                  }
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Location
                </label>
                <Input
                  name="location"
                  defaultValue={drive.location || ""}
                  maxLength={200}
                  disabled={!isDraft || isPending}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Application Deadline
                </label>
                <Input
                  name="application_deadline"
                  type="datetime-local"
                  defaultValue={
                    drive.application_deadline
                      ? new Date(drive.application_deadline)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  disabled={!isDraft || isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Package (LPA CTC)
                </label>
                <Input
                  name="package_lpa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="9999.99"
                  defaultValue={
                    drive.package_lpa !== null ? drive.package_lpa : ""
                  }
                  disabled={!isDraft || isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Monthly Stipend (₹)
                </label>
                <Input
                  name="stipend_monthly"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={
                    drive.stipend_monthly !== null ? drive.stipend_monthly : ""
                  }
                  disabled={!isDraft || isPending}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Job Description
              </label>
              <Textarea
                name="description"
                rows={4}
                defaultValue={drive.description || ""}
                disabled={!isDraft || isPending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Compensation Details &amp; Perks
              </label>
              <Textarea
                name="compensation_details"
                rows={2}
                defaultValue={drive.compensation_details || ""}
                disabled={!isDraft || isPending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Additional Requirements &amp; Instructions
              </label>
              <Textarea
                name="requirements_info"
                rows={2}
                defaultValue={drive.requirements_info || ""}
                disabled={!isDraft || isPending}
              />
            </div>

            {isDraft && (
              <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Details"}
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Tab 2: Eligibility Criteria */}
      {activeTab === "eligibility" && (
        <Card className="p-6">
          <form
            action={handleUpdateEligibility}
            className="flex flex-col gap-6"
          >
            <div className="pb-3 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold">
                Global Threshold Criteria
              </h3>
              <Text className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Every drive has exactly one criteria configuration. Evaluated
                authoritatively on the database server.
              </Text>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Minimum CGPA Required (0.00 - 10.00)
                </label>
                <Input
                  name="minimum_cgpa"
                  type="number"
                  step="0.01"
                  min="0.00"
                  max="10.00"
                  required
                  defaultValue={eligibility?.minimum_cgpa ?? 0.0}
                  disabled={!isDraft || isPending}
                />
                <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
                  Students with CGPA below this threshold receive
                  CGPA_BELOW_MINIMUM.
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Maximum Active Backlogs Permitted
                </label>
                <Input
                  name="maximum_active_backlogs"
                  type="number"
                  step="1"
                  min="0"
                  required
                  defaultValue={eligibility?.maximum_active_backlogs ?? 0}
                  disabled={!isDraft || isPending}
                />
                <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
                  Students exceeding this limit receive
                  ACTIVE_BACKLOG_LIMIT_EXCEEDED.
                </span>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="exclude_previously_selected_placement"
                  value="true"
                  defaultChecked={
                    eligibility?.exclude_previously_selected_placement ?? true
                  }
                  disabled={!isDraft || isPending}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium block">
                    Exclude Previously Selected Placement Candidates (One-Offer
                    Rule)
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] block mt-0.5">
                    If checked, students with an existing SELECTED application
                    on any full-time PLACEMENT drive are disqualified. (Prior
                    selected INTERNSHIPS do not exclude).
                  </span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Informational / Special Requirements
              </label>
              <Textarea
                name="informational_requirements"
                rows={3}
                placeholder="Disciplinary conduct requirements, specific department requirements..."
                defaultValue={eligibility?.informational_requirements || ""}
                disabled={!isDraft || isPending}
              />
            </div>

            {isDraft && (
              <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Eligibility Criteria"}
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Tab 3: Target Cohorts (Batches) */}
      {activeTab === "cohorts" && (
        <Card className="p-6">
          <div className="flex flex-col gap-6">
            <div className="pb-3 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold">
                Eligible Academic Programs &amp; Batches
              </h3>
              <Text className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Specify exactly which academic programs and graduation batches
                are eligible for this drive.
              </Text>
            </div>

            {/* List of configured cohorts */}
            <div className="flex flex-col gap-2">
              {selectedCohorts.length === 0 ? (
                <p className="text-sm text-amber-500 italic">
                  No cohorts configured. At least one program and batch must be
                  added before this drive can be published.
                </p>
              ) : (
                <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                  {selectedCohorts.map((cohort, index) => {
                    const prog = allPrograms.find(
                      (p) => p.id === cohort.program_id
                    );
                    return (
                      <div
                        key={`${cohort.program_id}-${cohort.batch}`}
                        className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="info">{prog?.code || "PROG"}</Badge>
                          <div>
                            <span className="text-sm font-medium">
                              {prog?.display_name || "Academic Program"}
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                              Batch: {cohort.batch} ({prog?.degree_level})
                            </span>
                          </div>
                        </div>

                        {isDraft && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCohort(index)}
                            disabled={isPending}
                            className="text-red-500 hover:text-red-600 text-xs"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Cohort Form (Draft Only) */}
            {isDraft && (
              <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium mb-1">
                    Select Program
                  </label>
                  <Select
                    value={newCohortProgram}
                    onChange={(e) => setNewCohortProgram(e.target.value)}
                  >
                    <option value="" disabled>
                      Select an academic program...
                    </option>
                    {allPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.display_name} ({p.degree_level})
                        {!p.placement_eligible ? " [Non-Placement]" : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-full sm:w-36">
                  <label className="block text-xs font-medium mb-1">
                    Graduation Batch
                  </label>
                  <Input
                    placeholder="e.g. 2026"
                    value={newCohortBatch}
                    onChange={(e) => setNewCohortBatch(e.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCohort}
                  disabled={isPending}
                >
                  + Add Cohort
                </Button>
              </div>
            )}

            {isDraft && (
              <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  variant="primary"
                  onClick={saveCohorts}
                  disabled={isPending || selectedCohorts.length === 0}
                >
                  {isPending ? "Saving..." : "Save Cohorts"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab 4: Recruiter Access Grants */}
      {activeTab === "recruiters" && (
        <Card className="p-6">
          <div className="flex flex-col gap-6">
            <div className="pb-3 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold">
                Recruiter Explicit Drive Access Grants
              </h3>
              <Text className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Recruiters only see published drives when granted explicit
                access. Grants require an active contact at the drive&apos;s
                company.
              </Text>
            </div>

            {/* Grant New Recruiter Access (Super Admin & Secretary Only) */}
            {canPublishOrClose && (
              <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium mb-1">
                    Select Recruiter at {drive.company?.name}
                  </label>
                  <Select
                    value={selectedRecruiter}
                    onChange={(e) => setSelectedRecruiter(e.target.value)}
                  >
                    <option value="" disabled>
                      Select an eligible recruiter...
                    </option>
                    {companyRecruiters.map((cr) => (
                      <option
                        key={cr.id}
                        value={cr.id}
                        disabled={!cr.contact.is_active}
                      >
                        {cr.contact.full_name} ({cr.contact.email})
                        {!cr.contact.is_active ? " [Inactive Contact]" : ""}
                      </option>
                    ))}
                  </Select>
                  {companyRecruiters.length === 0 && (
                    <span className="text-[11px] text-amber-500 mt-1 block">
                      No recruiters currently onboarded for this company. Invite
                      recruiters via Staff &gt; Recruiters.
                    </span>
                  )}
                </div>

                <div className="w-full sm:w-48">
                  <label className="block text-xs font-medium mb-1">
                    Grant Expiry (Optional)
                  </label>
                  <Input
                    type="date"
                    value={grantExpiresAt}
                    onChange={(e) => setGrantExpiresAt(e.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleGrantRecruiterAccess}
                  disabled={isPending || companyRecruiters.length === 0}
                >
                  {isPending ? "Granting..." : "Grant Access"}
                </Button>
              </div>
            )}

            {/* Grants List */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                Active &amp; Historical Grants
              </h4>

              {accessGrants.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] italic">
                  No recruiter access grants recorded for this drive.
                </p>
              ) : (
                <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                  {accessGrants.map((grant) => {
                    const isRevoked = !!grant.revoked_at;
                    const isExpired =
                      grant.expires_at &&
                      new Date(grant.expires_at).getTime() <= now;
                    const isActive = !isRevoked && !isExpired;

                    return (
                      <div
                        key={grant.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[var(--color-bg-primary)] gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">
                              {grant.recruiter_profile?.contact?.full_name ||
                                "Recruiter"}
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              ({grant.recruiter_profile?.contact?.email})
                            </span>
                            <Badge
                              variant={
                                isActive
                                  ? "success"
                                  : isRevoked
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {isActive
                                ? "ACTIVE"
                                : isRevoked
                                  ? "REVOKED"
                                  : "EXPIRED"}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                            <span>
                              Granted:{" "}
                              {new Date(grant.granted_at).toLocaleDateString()}{" "}
                              {grant.granter?.display_name &&
                                `by ${grant.granter.display_name}`}
                            </span>
                            {grant.expires_at && (
                              <span>
                                Expiry:{" "}
                                {new Date(
                                  grant.expires_at
                                ).toLocaleDateString()}
                              </span>
                            )}
                            {grant.revoked_at && (
                              <span className="text-red-500">
                                Revoked:{" "}
                                {new Date(
                                  grant.revoked_at
                                ).toLocaleDateString()}{" "}
                                {grant.revoker?.display_name &&
                                  `by ${grant.revoker.display_name}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {canPublishOrClose && isActive && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setConfirmAction({
                                type: "revoke",
                                grantId: grant.id,
                              })
                            }
                            disabled={isPending}
                          >
                            Revoke Access
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

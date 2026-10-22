"use client";

import React, { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  matchAlumniCompanyAction,
  verifyAlumniProfileAction,
} from "@/lib/actions/alumni";

interface AlumnusDetail {
  alumni_id: string | null;
  profile_id: string | null;
  student_name: string | null;
  graduation_year: number | null;
  program_code: string | null;
  program_name: string | null;
  company_id: string | null;
  company_name: string | null;
  current_organization: string | null;
  current_role: string | null;
  professional_domain: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  higher_studies_institution: string | null;
  higher_studies_program: string | null;
  higher_studies_year_start: number | null;
  willing_to_mentor: boolean | null;
  willing_to_refer: boolean | null;
  willing_to_support_placement: boolean | null;
  public_alumni_enabled: boolean | null;
  last_verified_at: string | null;
  last_verified_by: string | null;
}

interface EmploymentItem {
  employment_id: string | null;
  organization: string | null;
  role: string | null;
  started_at: string | null;
  ended_at: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  company_name: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface AlumnusDetailClientProps {
  alumnus: AlumnusDetail;
  employmentHistory: EmploymentItem[];
  companies: CompanyOption[];
}

export function AlumnusDetailClient({
  alumnus,
  employmentHistory,
  companies,
}: AlumnusDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Match Company State
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [matchReason, setMatchReason] = useState("");
  const [showMatchModal, setShowMatchModal] = useState(false);

  const handleVerify = () => {
    if (!alumnus.alumni_id) return;
    setStatusMsg(null);
    startTransition(async () => {
      const res = await verifyAlumniProfileAction(alumnus.alumni_id!);
      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: "Alumni profile verified successfully.",
        });
      }
    });
  };

  const handleMatchCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumnus.alumni_id) return;
    setStatusMsg(null);

    if (!selectedCompanyId || !matchReason.trim()) {
      setStatusMsg({
        type: "error",
        text: "Select a canonical company and state a valid reason.",
      });
      return;
    }

    startTransition(async () => {
      const res = await matchAlumniCompanyAction(
        alumnus.alumni_id!,
        selectedCompanyId,
        matchReason
      );

      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: "Employer matched to canonical company successfully.",
        });
        setShowMatchModal(false);
        setSelectedCompanyId("");
        setMatchReason("");
      }
    });
  };

  return (
    <div className="space-y-8">
      {statusMsg && (
        <div
          className={`p-4 rounded-[var(--radius-md)] text-sm ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
              : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Header Profile Summary */}
      <Card padding="lg" className="border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" size="sm">
                Class of {alumnus.graduation_year}
              </Badge>
              <Badge variant="default" size="sm">
                {alumnus.program_code}
              </Badge>
              {alumnus.last_verified_at ? (
                <Badge
                  variant="default"
                  size="sm"
                  className="bg-emerald-600 text-white"
                >
                  ✓ Verified Alumnus
                </Badge>
              ) : (
                <Badge variant="default" size="sm">
                  Unverified
                </Badge>
              )}
            </div>
            <Heading
              level={2}
              className="text-2xl font-bold text-[var(--color-text-primary)]"
            >
              {alumnus.student_name}
            </Heading>
            <Text variant="secondary" className="text-sm mt-0.5">
              Permanent Student Identity:{" "}
              <code className="text-xs">{alumnus.profile_id}</code>
            </Text>
          </div>

          <div className="flex items-center gap-2">
            {!alumnus.last_verified_at && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleVerify}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? "Verifying..." : "Verify Profile"}
              </Button>
            )}
            {!alumnus.company_id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowMatchModal(true)}
                disabled={isPending}
              >
                Match to Canonical Company
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Match Company Modal/Card */}
      {showMatchModal && (
        <Card
          padding="lg"
          className="border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20"
        >
          <form onSubmit={handleMatchCompany} className="space-y-4">
            <div className="flex justify-between items-center">
              <Heading
                level={3}
                className="text-base font-bold text-[var(--color-text-primary)]"
              >
                Match Unmatched Employer to Registered Company
              </Heading>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowMatchModal(false)}
              >
                Cancel
              </Button>
            </div>

            <Text variant="secondary" className="text-xs">
              Current free-text employer:{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {alumnus.current_organization || "None"}
              </span>
              . Matching links this alumnus to an authoritative company record
              and resets free-text to NULL atomically.
            </Text>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="match-company-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
                >
                  Select Registered Company *
                </label>
                <select
                  id="match-company-select"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  <option value="">-- Choose registered company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="match-reason-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
                >
                  Verification / Matching Reason *
                </label>
                <input
                  id="match-reason-input"
                  type="text"
                  placeholder="e.g. Verified via LinkedIn profile and company email domain"
                  value={matchReason}
                  onChange={(e) => setMatchReason(e.target.value)}
                  required
                  maxLength={300}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending || !selectedCompanyId}
              >
                {isPending ? "Matching..." : "Confirm Company Match"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Professional Coordinates */}
        <Card padding="md" className="border space-y-3">
          <Heading
            level={3}
            className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] border-b pb-2"
          >
            Professional Coordinates
          </Heading>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block">
                Employer
              </span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {alumnus.company_name || alumnus.current_organization || "—"}
              </span>
              {alumnus.company_name && (
                <Badge variant="default" size="sm" className="mt-1 text-[10px]">
                  Canonical Match
                </Badge>
              )}
            </div>

            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block">
                Role / Designation
              </span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {alumnus.current_role || "—"}
              </span>
            </div>

            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block">
                Professional Domain
              </span>
              <span className="text-[var(--color-text-primary)]">
                {alumnus.professional_domain || "—"}
              </span>
            </div>

            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block">
                Location
              </span>
              <span className="text-[var(--color-text-primary)]">
                {[alumnus.city, alumnus.country].filter(Boolean).join(", ") ||
                  "—"}
              </span>
            </div>

            <div className="col-span-2">
              <span className="text-xs text-[var(--color-text-secondary)] block">
                LinkedIn
              </span>
              {alumnus.linkedin_url ? (
                <a
                  href={alumnus.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-xs break-all"
                >
                  {alumnus.linkedin_url} ↗
                </a>
              ) : (
                <span className="text-xs text-[var(--color-text-secondary)] italic">
                  Not provided
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Institutional Engagement & Higher Studies */}
        <Card padding="md" className="border space-y-3">
          <Heading
            level={3}
            className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] border-b pb-2"
          >
            Engagement &amp; Higher Studies
          </Heading>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">
                Institutional Willingness
              </span>
              <div className="flex gap-2 flex-wrap">
                <Badge
                  variant={alumnus.willing_to_mentor ? "success" : "default"}
                  size="sm"
                >
                  {alumnus.willing_to_mentor
                    ? "✓ Mentorship"
                    : "✕ No Mentorship"}
                </Badge>
                <Badge
                  variant={alumnus.willing_to_refer ? "success" : "default"}
                  size="sm"
                >
                  {alumnus.willing_to_refer ? "✓ Referrals" : "✕ No Referrals"}
                </Badge>
                <Badge
                  variant={
                    alumnus.willing_to_support_placement ? "success" : "default"
                  }
                  size="sm"
                >
                  {alumnus.willing_to_support_placement
                    ? "✓ Placement Support"
                    : "✕ No Placement Support"}
                </Badge>
              </div>
            </div>

            <div className="pt-2 border-t">
              <span className="text-xs text-[var(--color-text-secondary)] block">
                Higher Studies
              </span>
              {alumnus.higher_studies_institution ? (
                <div className="mt-1">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {alumnus.higher_studies_program}
                  </span>{" "}
                  at {alumnus.higher_studies_institution} (
                  {alumnus.higher_studies_year_start})
                </div>
              ) : (
                <span className="text-xs text-[var(--color-text-secondary)] italic">
                  None recorded
                </span>
              )}
            </div>

            <div className="pt-2 border-t">
              <span className="text-xs text-[var(--color-text-secondary)] block">
                Public Directory Consent
              </span>
              <span className="text-xs font-medium">
                {alumnus.public_alumni_enabled
                  ? "Enabled by Alumnus"
                  : "Disabled by Alumnus"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Employment History Timeline */}
      <Card padding="lg" className="border space-y-4">
        <Heading
          level={3}
          className="text-lg font-semibold text-[var(--color-text-primary)] border-b pb-2"
        >
          Employment History Timeline ({employmentHistory.length})
        </Heading>

        {employmentHistory.length === 0 ? (
          <Text variant="secondary" className="text-sm py-4 text-center">
            No employment history recorded for this alumnus.
          </Text>
        ) : (
          <div className="divide-y border rounded-[var(--radius-md)]">
            {employmentHistory.map((emp, idx) => (
              <div key={emp.employment_id || idx} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {emp.role}
                    </span>{" "}
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                      at {emp.company_name || emp.organization}
                    </span>
                    <Text variant="secondary" className="text-xs mt-0.5">
                      {emp.started_at} &rarr; {emp.ended_at || "Present"}
                      {emp.city && ` &bull; ${emp.city}`}
                      {emp.country && `, ${emp.country}`}
                    </Text>
                    {emp.notes && (
                      <Text variant="secondary" className="text-xs mt-1 italic">
                        {emp.notes}
                      </Text>
                    )}
                  </div>
                  {emp.company_name && (
                    <Badge variant="default" size="sm">
                      Partner Company
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

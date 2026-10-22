"use client";

import React, { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  markStudentGraduatedAction,
  convertStudentToAlumniAction,
} from "@/lib/actions/alumni";

interface StudentOption {
  id: string;
  display_name: string;
  student_lifecycle_status: string;
  program_code: string;
  program_name: string;
  batch: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface GraduationManagementClientProps {
  activeStudents: StudentOption[];
  graduatedStudents: StudentOption[];
  companies: CompanyOption[];
}

export function GraduationManagementClient({
  activeStudents,
  graduatedStudents,
  companies,
}: GraduationManagementClientProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Workflow 1: Mark Graduated
  const [gradStudentId, setGradStudentId] = useState("");
  const [gradReason, setGradReason] = useState("");

  // Workflow 2: Convert to Alumni
  const [alumniStudentId, setAlumniStudentId] = useState("");
  const [matchType, setMatchType] = useState<"unmatched" | "matched">(
    "unmatched"
  );
  const [alumniOrg, setAlumniOrg] = useState("");
  const [alumniCompanyId, setAlumniCompanyId] = useState("");
  const [alumniRole, setAlumniRole] = useState("");
  const [alumniDomain, setAlumniDomain] = useState("");
  const [alumniCity, setAlumniCity] = useState("");
  const [alumniCountry, setAlumniCountry] = useState("India");
  const [alumniLinkedin, setAlumniLinkedin] = useState("");
  const [alumniReason, setAlumniReason] = useState(
    "Student completed degree requirements and transitioned to alumni"
  );

  const handleMarkGraduated = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!gradStudentId || !gradReason.trim()) {
      setStatusMsg({
        type: "error",
        text: "Please select a student and provide a valid reason.",
      });
      return;
    }

    startTransition(async () => {
      const res = await markStudentGraduatedAction(gradStudentId, gradReason);
      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: res.success || "Student graduated successfully.",
        });
        setGradStudentId("");
        setGradReason("");
      }
    });
  };

  const handleConvertToAlumni = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!alumniStudentId) {
      setStatusMsg({
        type: "error",
        text: "Please select a graduated student.",
      });
      return;
    }

    startTransition(async () => {
      const res = await convertStudentToAlumniAction(alumniStudentId, {
        companyId: matchType === "matched" ? alumniCompanyId || null : null,
        currentOrganization:
          matchType === "unmatched" ? alumniOrg || null : null,
        currentRole: alumniRole || null,
        professionalDomain: alumniDomain || null,
        city: alumniCity || null,
        country: alumniCountry || "India",
        linkedinUrl: alumniLinkedin || null,
        reason: alumniReason,
      });

      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: res.success || "Student converted to alumni successfully.",
        });
        setAlumniStudentId("");
        setAlumniOrg("");
        setAlumniCompanyId("");
        setAlumniRole("");
        setAlumniDomain("");
        setAlumniCity("");
        setAlumniLinkedin("");
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workflow 1: Mark Active Student Graduated */}
        <Card padding="lg" className="border flex flex-col justify-between">
          <form onSubmit={handleMarkGraduated} className="space-y-4">
            <div className="border-b pb-3">
              <Badge variant="default" size="sm" className="mb-2">
                Step 1: Graduation
              </Badge>
              <Heading
                level={2}
                className="text-xl font-bold text-[var(--color-text-primary)]"
              >
                Mark Student Graduated
              </Heading>
              <Text variant="secondary" className="text-xs mt-1">
                Transitions student from STUDENT_ACTIVE &rarr;
                STUDENT_GRADUATED. Account remains active.
              </Text>
            </div>

            <div>
              <label
                htmlFor="select-active-student"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Select Active Student *
              </label>
              <select
                id="select-active-student"
                value={gradStudentId}
                onChange={(e) => setGradStudentId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              >
                <option value="">
                  -- Choose active student ({activeStudents.length} available)
                  --
                </option>
                {activeStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} ({s.program_code} Class of {s.batch})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="grad-reason"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Reason / Senate Approval Reference *
              </label>
              <textarea
                id="grad-reason"
                rows={3}
                placeholder="e.g. Completed all degree credits, Senate approval meeting dated 2026-05-15"
                value={gradReason}
                onChange={(e) => setGradReason(e.target.value)}
                required
                maxLength={500}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending || !gradStudentId}
              >
                {isPending ? "Processing..." : "Mark Graduated"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Workflow 2: Convert Graduated Student to Alumni */}
        <Card padding="lg" className="border flex flex-col justify-between">
          <form onSubmit={handleConvertToAlumni} className="space-y-4">
            <div className="border-b pb-3">
              <Badge variant="default" size="sm" className="mb-2">
                Step 2: Alumni Transition
              </Badge>
              <Heading
                level={2}
                className="text-xl font-bold text-[var(--color-text-primary)]"
              >
                Transition to Alumni
              </Heading>
              <Text variant="secondary" className="text-xs mt-1">
                Transitions student from STUDENT_GRADUATED &rarr; ALUMNI.
                Creates authoritative alumni profile.
              </Text>
            </div>

            <div>
              <label
                htmlFor="select-grad-student"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Select Graduated Student *
              </label>
              <select
                id="select-grad-student"
                value={alumniStudentId}
                onChange={(e) => setAlumniStudentId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              >
                <option value="">
                  -- Choose graduated student ({graduatedStudents.length}{" "}
                  available) --
                </option>
                {graduatedStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} ({s.program_code} Class of {s.batch})
                  </option>
                ))}
              </select>
            </div>

            {/* Employer Mode: Matched vs Unmatched */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Initial Employer Linking
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="matchType"
                    checked={matchType === "unmatched"}
                    onChange={() => setMatchType("unmatched")}
                  />
                  <span>Free-text Employer</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="matchType"
                    checked={matchType === "matched"}
                    onChange={() => setMatchType("matched")}
                  />
                  <span>Match Registered Company</span>
                </label>
              </div>

              {matchType === "unmatched" ? (
                <input
                  type="text"
                  placeholder="e.g. Morphogenesis Architects"
                  value={alumniOrg}
                  onChange={(e) => setAlumniOrg(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              ) : (
                <select
                  value={alumniCompanyId}
                  onChange={(e) => setAlumniCompanyId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  <option value="">-- Select Registered Company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="alumni-role-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
                >
                  Role / Designation
                </label>
                <input
                  id="alumni-role-input"
                  type="text"
                  placeholder="e.g. Junior Urban Planner"
                  value={alumniRole}
                  onChange={(e) => setAlumniRole(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="alumni-domain-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
                >
                  Professional Domain
                </label>
                <input
                  id="alumni-domain-input"
                  type="text"
                  placeholder="e.g. Master Planning"
                  value={alumniDomain}
                  onChange={(e) => setAlumniDomain(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="alumni-city-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
                >
                  City
                </label>
                <input
                  id="alumni-city-input"
                  type="text"
                  placeholder="e.g. Pune"
                  value={alumniCity}
                  onChange={(e) => setAlumniCity(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="alumni-country-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
                >
                  Country
                </label>
                <input
                  id="alumni-country-input"
                  type="text"
                  placeholder="e.g. India"
                  value={alumniCountry}
                  onChange={(e) => setAlumniCountry(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="alumni-reason-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Transition Reason *
              </label>
              <textarea
                id="alumni-reason-input"
                rows={2}
                value={alumniReason}
                onChange={(e) => setAlumniReason(e.target.value)}
                required
                maxLength={500}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending || !alumniStudentId}
              >
                {isPending ? "Transitioning..." : "Transition to Alumni"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

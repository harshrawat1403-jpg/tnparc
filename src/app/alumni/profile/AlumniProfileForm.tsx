"use client";

import React, { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  updateOwnAlumniProfileAction,
  addOwnAlumniEmploymentAction,
} from "@/lib/actions/alumni";

interface AlumniProfileData {
  id: string;
  graduation_year: number;
  program_code: string;
  program_name: string;
  company_id: string | null;
  company_name?: string | null;
  current_organization: string | null;
  current_role: string | null;
  professional_domain: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  higher_studies_institution: string | null;
  higher_studies_program: string | null;
  higher_studies_year_start: number | null;
  willing_to_mentor: boolean;
  willing_to_refer: boolean;
  willing_to_support_placement: boolean;
  public_alumni_enabled: boolean;
  consent_recorded_at: string | null;
  last_verified_at: string | null;
}

interface EmploymentRecord {
  id: string;
  organization: string;
  role: string;
  started_at: string;
  ended_at: string | null;
  professional_domain: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
}

interface AlumniProfileFormProps {
  profile: AlumniProfileData;
  employmentHistory: EmploymentRecord[];
}

export function AlumniProfileForm({
  profile,
  employmentHistory,
}: AlumniProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form State
  const [currentOrg, setCurrentOrg] = useState(
    profile.current_organization || ""
  );
  const [currentRole, setCurrentRole] = useState(profile.current_role || "");
  const [domain, setDomain] = useState(profile.professional_domain || "");
  const [city, setCity] = useState(profile.city || "");
  const [country, setCountry] = useState(profile.country || "India");
  const [linkedin, setLinkedin] = useState(profile.linkedin_url || "");
  const [higherInst, setHigherInst] = useState(
    profile.higher_studies_institution || ""
  );
  const [higherProg, setHigherProg] = useState(
    profile.higher_studies_program || ""
  );
  const [higherYear, setHigherYear] = useState<string>(
    profile.higher_studies_year_start
      ? String(profile.higher_studies_year_start)
      : ""
  );

  // Engagement Flags
  const [mentor, setMentor] = useState(profile.willing_to_mentor);
  const [refer, setRefer] = useState(profile.willing_to_refer);
  const [placement, setPlacement] = useState(
    profile.willing_to_support_placement
  );

  // Privacy Toggle
  const [publicEnabled, setPublicEnabled] = useState(
    profile.public_alumni_enabled
  );

  // Employment Modal / Add state
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empOrg, setEmpOrg] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empStart, setEmpStart] = useState("");
  const [empEnd, setEmpEnd] = useState("");
  const [empCity, setEmpCity] = useState("");
  const [empCountry, setEmpCountry] = useState("India");
  const [empNotes, setEmpNotes] = useState("");
  const [empError, setEmpError] = useState<string | null>(null);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    startTransition(async () => {
      const res = await updateOwnAlumniProfileAction({
        companyId: profile.company_id, // preserve staff-matched company if exists
        currentOrganization: profile.company_id ? null : currentOrg,
        currentRole: currentRole || null,
        professionalDomain: domain || null,
        city: city || null,
        country: country || "India",
        linkedinUrl: linkedin || null,
        higherStudiesInstitution: higherInst || null,
        higherStudiesProgram: higherProg || null,
        higherStudiesYearStart: higherYear ? parseInt(higherYear, 10) : null,
        willingToMentor: mentor,
        willingToRefer: refer,
        willingToSupportPlacement: placement,
        publicAlumniEnabled: publicEnabled,
      });

      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: "Alumni profile updated successfully.",
        });
      }
    });
  };

  const handleAddEmployment = (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError(null);

    if (!empOrg.trim() || !empRole.trim() || !empStart) {
      setEmpError("Organization, role, and start date are required.");
      return;
    }

    startTransition(async () => {
      const res = await addOwnAlumniEmploymentAction({
        organization: empOrg.trim(),
        role: empRole.trim(),
        startedAt: empStart,
        endedAt: empEnd || null,
        city: empCity.trim() || null,
        country: empCountry.trim() || "India",
        notes: empNotes.trim() || null,
      });

      if (res.error) {
        setEmpError(res.error);
      } else {
        setShowAddEmp(false);
        setEmpOrg("");
        setEmpRole("");
        setEmpStart("");
        setEmpEnd("");
        setEmpCity("");
        setEmpNotes("");
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

      {/* Profile Overview Card */}
      <Card padding="md" className="border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Text
              variant="secondary"
              className="text-xs uppercase tracking-wider font-semibold"
            >
              Permanent Academic Cohort
            </Text>
            <div className="flex items-center gap-2 mt-1">
              <Heading
                level={2}
                className="text-xl font-bold text-[var(--color-text-primary)]"
              >
                Class of {profile.graduation_year} &bull; {profile.program_code}
              </Heading>
              <Badge variant="default" size="sm">
                {profile.program_name}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.last_verified_at ? (
              <Badge
                variant="default"
                size="sm"
                className="bg-emerald-600 text-white"
              >
                ✓ Staff Verified
              </Badge>
            ) : (
              <Badge variant="default" size="sm">
                Pending Staff Verification
              </Badge>
            )}
            {profile.consent_recorded_at && profile.public_alumni_enabled ? (
              <Badge variant="default" size="sm">
                Public Directory Enabled
              </Badge>
            ) : (
              <Badge variant="default" size="sm">
                Directory Hidden
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Main Profile Form */}
      <form onSubmit={handleProfileSubmit} className="space-y-8">
        <Card padding="lg" className="border space-y-6">
          <Heading
            level={3}
            className="text-lg font-semibold text-[var(--color-text-primary)] border-b pb-2"
          >
            Professional Information
          </Heading>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="org-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Current Employer / Organization
              </label>
              {profile.company_id ? (
                <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] border text-sm text-[var(--color-text-primary)] flex items-center justify-between">
                  <span>
                    {profile.company_name || "Matched Corporate Partner"}
                  </span>
                  <Badge variant="default" size="sm">
                    Verified Match
                  </Badge>
                </div>
              ) : (
                <input
                  id="org-input"
                  type="text"
                  placeholder="e.g. HOK Architects"
                  value={currentOrg}
                  onChange={(e) => setCurrentOrg(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              )}
            </div>

            <div>
              <label
                htmlFor="role-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Current Designation / Role
              </label>
              <input
                id="role-input"
                type="text"
                placeholder="e.g. Senior Urban Planner"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                maxLength={150}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="domain-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Professional Domain
              </label>
              <input
                id="domain-input"
                type="text"
                placeholder="e.g. Sustainable Design, Transit Planning"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="linkedin-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                LinkedIn Profile URL
              </label>
              <input
                id="linkedin-input"
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="city-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                City
              </label>
              <input
                id="city-input"
                type="text"
                placeholder="e.g. Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="country-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Country
              </label>
              <input
                id="country-input"
                type="text"
                placeholder="e.g. India"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
        </Card>

        {/* Higher Studies Card */}
        <Card padding="lg" className="border space-y-6">
          <Heading
            level={3}
            className="text-lg font-semibold text-[var(--color-text-primary)] border-b pb-2"
          >
            Higher Studies (Optional)
          </Heading>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="higher-inst"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Institution / University
              </label>
              <input
                id="higher-inst"
                type="text"
                placeholder="e.g. TU Delft, Harvard GSD"
                value={higherInst}
                onChange={(e) => setHigherInst(e.target.value)}
                maxLength={150}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="higher-prog"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Degree / Program
              </label>
              <input
                id="higher-prog"
                type="text"
                placeholder="e.g. Master of Urban Planning"
                value={higherProg}
                onChange={(e) => setHigherProg(e.target.value)}
                maxLength={150}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="higher-year"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1"
              >
                Commencement Year
              </label>
              <input
                id="higher-year"
                type="number"
                placeholder="e.g. 2025"
                value={higherYear}
                onChange={(e) => setHigherYear(e.target.value)}
                min={profile.graduation_year}
                max={2100}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
        </Card>

        {/* Institutional Engagement & Privacy */}
        <Card padding="lg" className="border space-y-6">
          <Heading
            level={3}
            className="text-lg font-semibold text-[var(--color-text-primary)] border-b pb-2"
          >
            Institutional Engagement & Privacy
          </Heading>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mentor}
                onChange={(e) => setMentor(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Willing to Mentor Current Students
                </span>
                <Text variant="secondary" className="text-xs">
                  Offer portfolio reviews, career guidance, and academic
                  mentoring to VNIT architecture & planning students.
                </Text>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={refer}
                onChange={(e) => setRefer(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Willing to Provide Industry Referrals
                </span>
                <Text variant="secondary" className="text-xs">
                  Connect graduating batches and junior alumni to job and
                  internship opportunities at your practice.
                </Text>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={placement}
                onChange={(e) => setPlacement(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Support Department Placement & Industry Relations
                </span>
                <Text variant="secondary" className="text-xs">
                  Collaborate with the Training & Placement Cell on guest
                  lectures, jury panels, and campus placement drives.
                </Text>
              </div>
            </label>

            <div className="pt-4 border-t">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicEnabled}
                  onChange={(e) => setPublicEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <div>
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">
                    Publish My Profile to Public Alumni Directory (/alumni)
                  </span>
                  <Text variant="secondary" className="text-xs">
                    Allow prospective students, recruiters, and the public to
                    discover your professional designation and practice. Your
                    email, phone, and academic grades are strictly never
                    disclosed publicly.
                  </Text>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Alumni Profile"}
            </Button>
          </div>
        </Card>
      </form>

      {/* Employment History Section */}
      <Card padding="lg" className="border space-y-6">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <Heading
              level={3}
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Professional Employment History
            </Heading>
            <Text variant="secondary" className="text-xs">
              Chronological career progression timeline. Historical employment
              records are permanently preserved.
            </Text>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowAddEmp(!showAddEmp)}
          >
            {showAddEmp ? "Cancel" : "+ Add Position"}
          </Button>
        </div>

        {/* Add Employment Form Modal/Inline */}
        {showAddEmp && (
          <form
            onSubmit={handleAddEmployment}
            className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] border space-y-4"
          >
            <Text className="text-sm font-semibold text-[var(--color-text-primary)]">
              Add Employment Record
            </Text>

            {empError && (
              <div className="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded border border-red-200">
                {empError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="emp-org"
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  Organization / Practice *
                </label>
                <input
                  id="emp-org"
                  type="text"
                  placeholder="e.g. Gensler"
                  value={empOrg}
                  onChange={(e) => setEmpOrg(e.target.value)}
                  required
                  maxLength={200}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="emp-role"
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  Role / Title *
                </label>
                <input
                  id="emp-role"
                  type="text"
                  placeholder="e.g. Project Architect"
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  required
                  maxLength={150}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="emp-start"
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  Start Date *
                </label>
                <input
                  id="emp-start"
                  type="date"
                  value={empStart}
                  onChange={(e) => setEmpStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="emp-end"
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  End Date (Leave blank if currently working)
                </label>
                <input
                  id="emp-end"
                  type="date"
                  value={empEnd}
                  onChange={(e) => setEmpEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="emp-city"
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  City
                </label>
                <input
                  id="emp-city"
                  type="text"
                  placeholder="e.g. New Delhi"
                  value={empCity}
                  onChange={(e) => setEmpCity(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="emp-country"
                  className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  Country
                </label>
                <input
                  id="emp-country"
                  type="text"
                  placeholder="e.g. India"
                  value={empCountry}
                  onChange={(e) => setEmpCountry(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="emp-notes"
                className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
              >
                Brief Description of Key Projects / Achievements
              </label>
              <textarea
                id="emp-notes"
                rows={2}
                placeholder="Major master planning, transit-oriented development, or sustainable design projects handled..."
                value={empNotes}
                onChange={(e) => setEmpNotes(e.target.value)}
                maxLength={1000}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddEmp(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending}
              >
                {isPending ? "Adding..." : "Add Position"}
              </Button>
            </div>
          </form>
        )}

        {/* Existing Records List */}
        {employmentHistory.length === 0 ? (
          <Text variant="secondary" className="text-sm py-4 text-center">
            No employment history entries recorded yet.
          </Text>
        ) : (
          <div className="divide-y border rounded-[var(--radius-md)]">
            {employmentHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {item.role}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                      at {item.organization}
                    </span>
                  </div>
                  <Text variant="secondary" className="text-xs mt-0.5">
                    {item.started_at} &rarr; {item.ended_at || "Present"}
                    {item.city && ` &bull; ${item.city}`}
                    {item.country && `, ${item.country}`}
                  </Text>
                  {item.notes && (
                    <Text variant="secondary" className="text-xs mt-1 italic">
                      {item.notes}
                    </Text>
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

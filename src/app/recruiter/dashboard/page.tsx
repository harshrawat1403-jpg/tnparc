import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitSignOut } from "@/lib/actions/auth";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const instant = false;

export const metadata: Metadata = {
  title: "Recruiter Dashboard",
  description: "Recruiter portal for verified industry partners.",
};

export default async function RecruiterDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/recruiter/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "RECRUITER" || !profile.is_active) {
    redirect("/unauthorized");
  }

  // Fetch recruiter operational profile, company, and contact
  const { data: recruiterProfile } = await supabase
    .from("recruiter_profiles")
    .select("id, company_id, recruiter_contact_id, created_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  let company = null;
  let contact = null;

  if (recruiterProfile) {
    const [compRes, contRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, website, description, is_archived")
        .eq("id", recruiterProfile.company_id)
        .maybeSingle(),
      supabase
        .from("recruiter_contacts")
        .select("id, full_name, email, phone, designation, is_active")
        .eq("id", recruiterProfile.recruiter_contact_id)
        .maybeSingle(),
    ]);
    company = compRes.data;
    contact = contRes.data;
  }

  const displayName = contact?.full_name || profile.display_name;

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-8">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="default" size="sm">
                  Industry Partner Portal
                </Badge>
                <Badge variant="warning" size="sm">
                  RECRUITER
                </Badge>
                {company ? (
                  <Badge
                    variant={!company.is_archived ? "success" : "danger"}
                    size="sm"
                  >
                    {!company.is_archived
                      ? "Verified Partner"
                      : "Archived Partner"}
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Pending Organization Link
                  </Badge>
                )}
              </div>
              <Heading
                level={1}
                className="text-2xl sm:text-3xl font-semibold tracking-tight"
              >
                Welcome, {displayName}
              </Heading>
              <Text variant="secondary" className="text-sm mt-1">
                {company?.name ? `${company.name} · ` : ""}Department of
                Architecture & Planning — VNIT Nagpur
              </Text>
            </div>

            <form action={submitSignOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign Out
              </Button>
            </form>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organization & Contact Card */}
            <Card padding="lg" className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Heading level={3} className="text-lg font-medium">
                    Organization & Profile Details
                  </Heading>
                  {contact?.is_active ? (
                    <Badge variant="success" size="sm">
                      Active Contact
                    </Badge>
                  ) : contact ? (
                    <Badge variant="danger" size="sm">
                      Inactive Contact
                    </Badge>
                  ) : null}
                </div>

                {company ? (
                  <dl className="grid grid-cols-1 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Company Name
                      </dt>
                      <dd className="font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {company.name}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Website
                      </dt>
                      <dd className="text-[var(--color-text-primary)] mt-0.5 flex items-center gap-2">
                        {company.website ? (
                          <a
                            href={
                              company.website.startsWith("http")
                                ? company.website
                                : `https://${company.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            {company.website}
                            <span aria-hidden="true">&nearr;</span>
                          </a>
                        ) : (
                          <span className="text-[var(--color-text-secondary)]">
                            —
                          </span>
                        )}
                      </dd>
                    </div>

                    {company.description && (
                      <div>
                        <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                          Description
                        </dt>
                        <dd className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          {company.description}
                        </dd>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--color-border)]">
                      <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Contact Person & Role
                      </dt>
                      <dd className="font-medium text-[var(--color-text-primary)] mt-0.5">
                        {contact?.full_name || displayName}
                        {contact?.designation && (
                          <span className="text-[var(--color-text-secondary)] font-normal ml-2">
                            ({contact.designation})
                          </span>
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Email & Phone
                      </dt>
                      <dd className="text-[var(--color-text-primary)] mt-0.5 space-y-0.5">
                        <div className="font-mono text-xs">
                          {contact?.email || user.email}
                        </div>
                        {contact?.phone && (
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {contact.phone}
                          </div>
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    Your recruiter account is active, but not yet linked to an
                    organization profile. If you received an invitation token,
                    please complete the onboarding acceptance link.
                  </div>
                )}
              </div>

              {recruiterProfile && (
                <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex justify-between">
                  <span>Linked since</span>
                  <span>
                    {new Date(recruiterProfile.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </Card>

            {/* Student Privacy & Confidentiality Card */}
            <Card padding="lg" className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Heading level={3} className="text-lg font-medium">
                    Student Privacy & Security
                  </Heading>
                  <Badge variant="default" size="sm">
                    Zero Student Data
                  </Badge>
                </div>

                <Text
                  variant="secondary"
                  className="text-xs leading-relaxed mb-4"
                >
                  VNIT Training & Placement strictly enforces candidate data
                  confidentiality. Recruiter accounts operate under isolated
                  Row-Level Security policies.
                </Text>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                        Candidate Privacy Isolation
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        Student profiles, resumes, academic transcripts, and
                        backlogs are strictly confidential and inaccessible.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                        Skill Claims & Evidence Shield
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        Internal student skill claims, proficiency ratings, and
                        evidence artifacts are private to T&P staff.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                        Drive-Scoped Access (Phase 7)
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        Applicant data is only released when students
                        deliberately apply to approved drives published by your
                        company.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                RLS Status:{" "}
                <strong className="text-[var(--color-text-primary)]">
                  Default-Deny Enforced
                </strong>
              </div>
            </Card>

            {/* Placement Drives Notice (Phase 7) */}
            <Card padding="lg" className="md:col-span-2 border-dashed">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heading level={3} className="text-base font-medium">
                      Campus Placement Drives & Recruitment
                    </Heading>
                    <Badge variant="warning" size="sm">
                      Phase 7 Upcoming
                    </Badge>
                  </div>
                  <Text variant="secondary" className="text-sm">
                    Placement drives will be available in Phase 7.
                  </Text>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2 max-w-3xl leading-relaxed">
                    In Phase 7, authorized recruiters will be able to submit
                    placement drive proposals, define job roles and compensation
                    packages, review verified applicant submissions, and
                    coordinate recruitment rounds with the Training & Placement
                    cell.
                  </p>
                </div>

                <div className="shrink-0 text-xs px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] font-mono text-[var(--color-text-secondary)]">
                  Status: Phase 6 Initialized
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

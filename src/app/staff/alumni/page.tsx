import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const instant = false;

export const metadata: Metadata = {
  title: "Staff Alumni Directory & Analytics | VNIT Nagpur",
  description:
    "Manage alumni relationships, corporate matching, mentorship willingness, and directory verifications.",
};

interface AlumniAnalytics {
  total_alumni: number;
  verified_alumni: number;
  public_directory_alumni: number;
  willing_to_mentor_count: number;
  willing_to_refer_count: number;
  willing_to_support_placement_count: number;
  unmatched_employer_count: number;
}

export default async function StaffAlumniDirectoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/alumni");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch analytics RPC
  const { data: analyticsData } = await supabase.rpc(
    "get_staff_alumni_analytics"
  );
  const analytics: AlumniAnalytics =
    (analyticsData as unknown as AlumniAnalytics) || {
      total_alumni: 0,
      verified_alumni: 0,
      public_directory_alumni: 0,
      willing_to_mentor_count: 0,
      willing_to_refer_count: 0,
      willing_to_support_placement_count: 0,
      unmatched_employer_count: 0,
    };

  // Fetch scoped alumni from view
  const { data: alumniList, error } = await supabase
    .from("v_staff_alumni_directory")
    .select("*")
    .order("graduation_year", { ascending: false })
    .order("student_name", { ascending: true });

  const alumni = alumniList || [];

  // Fetch bounded staff analytics RPCs
  const { data: companiesAnalyticsData } = await supabase.rpc(
    "get_staff_alumni_by_company",
    { p_limit: 6, p_offset: 0 }
  );
  const { data: yearsAnalyticsData } = await supabase.rpc(
    "get_staff_alumni_by_year"
  );
  const { data: outreachAnalyticsData } = await supabase.rpc(
    "get_staff_alumni_outreach_candidates",
    { p_limit: 6, p_offset: 0 }
  );

  const companiesAnalytics = companiesAnalyticsData || [];
  const yearsAnalytics = yearsAnalyticsData || [];
  const outreachCandidates = outreachAnalyticsData || [];

  return (
    <div className="py-10">
      <Container size="lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)] mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" size="sm">
                Staff Portal
              </Badge>
              <Badge variant="default" size="sm">
                Alumni &amp; Industry
              </Badge>
            </div>
            <Heading
              level={1}
              className="text-2xl sm:text-3xl font-bold tracking-tight"
            >
              Alumni Directory &amp; Industry Relations
            </Heading>
            <Text variant="secondary" className="text-sm mt-1">
              Authoritative view of graduated alumni, institutional engagement,
              and employer verification.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/staff/alumni/graduation">
              <Button variant="primary" size="sm">
                + Graduation &amp; Transition
              </Button>
            </Link>
            <Link href="/alumni" target="_blank">
              <Button variant="secondary" size="sm">
                Public Directory ↗
              </Button>
            </Link>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Total Alumni
            </Text>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {analytics.total_alumni}
            </div>
          </Card>
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Verified
            </Text>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {analytics.verified_alumni}
            </div>
          </Card>
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Public Directory
            </Text>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {analytics.public_directory_alumni}
            </div>
          </Card>
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Mentors
            </Text>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {analytics.willing_to_mentor_count}
            </div>
          </Card>
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Referrals
            </Text>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {analytics.willing_to_refer_count}
            </div>
          </Card>
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Placement Aid
            </Text>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {analytics.willing_to_support_placement_count}
            </div>
          </Card>
          <Card padding="sm" className="border text-center">
            <Text
              variant="secondary"
              className="text-xs font-semibold uppercase"
            >
              Unmatched Co.
            </Text>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {analytics.unmatched_employer_count}
            </div>
          </Card>
        </div>

        {/* Deep Analytics Grid: Companies, Years, and Outreach */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Alumni by Company */}
          <Card padding="md" className="border space-y-3">
            <div className="border-b pb-2 flex justify-between items-center">
              <Heading
                level={3}
                className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]"
              >
                Alumni by Employer
              </Heading>
              <Badge variant="default" size="sm">
                Top Practices
              </Badge>
            </div>
            {companiesAnalytics.length === 0 ? (
              <Text variant="secondary" className="text-xs py-4 text-center">
                No employer data available in current scope.
              </Text>
            ) : (
              <div className="divide-y divide-[var(--color-border)] text-sm">
                {companiesAnalytics.map((c, i) => (
                  <div
                    key={i}
                    className="py-2 flex justify-between items-center"
                  >
                    <div className="truncate mr-2">
                      <span className="font-medium text-[var(--color-text-primary)] block truncate">
                        {c.company_name}
                      </span>
                      <Badge
                        variant="default"
                        size="sm"
                        className="text-[10px] scale-90 -ml-1"
                      >
                        {c.is_canonical ? "Canonical Co." : "Free-text"}
                      </Badge>
                    </div>
                    <span className="font-semibold text-xs text-[var(--color-text-secondary)]">
                      {c.alumni_count}{" "}
                      {Number(c.alumni_count) === 1 ? "alumnus" : "alumni"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Alumni by Graduation Year */}
          <Card padding="md" className="border space-y-3">
            <div className="border-b pb-2 flex justify-between items-center">
              <Heading
                level={3}
                className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]"
              >
                Alumni by Graduation Year
              </Heading>
              <Badge variant="default" size="sm">
                Cohorts
              </Badge>
            </div>
            {yearsAnalytics.length === 0 ? (
              <Text variant="secondary" className="text-xs py-4 text-center">
                No cohort data available in current scope.
              </Text>
            ) : (
              <div className="divide-y divide-[var(--color-border)] text-sm">
                {yearsAnalytics.map((y, i) => (
                  <div
                    key={i}
                    className="py-2 flex justify-between items-center"
                  >
                    <span className="font-medium text-[var(--color-text-primary)]">
                      Class of {y.graduation_year}
                    </span>
                    <span className="font-semibold text-xs text-[var(--color-text-secondary)]">
                      {y.alumni_count}{" "}
                      {Number(y.alumni_count) === 1 ? "alumnus" : "alumni"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Outreach Candidates */}
          <Card padding="md" className="border space-y-3">
            <div className="border-b pb-2 flex justify-between items-center">
              <Heading
                level={3}
                className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]"
              >
                Outreach Candidates
              </Heading>
              <Badge variant="default" size="sm">
                Mentors / Referrals
              </Badge>
            </div>
            {outreachCandidates.length === 0 ? (
              <Text variant="secondary" className="text-xs py-4 text-center">
                No active outreach candidates recorded.
              </Text>
            ) : (
              <div className="divide-y divide-[var(--color-border)] text-sm">
                {outreachCandidates.map((cand, i) => (
                  <div
                    key={i}
                    className="py-2 flex justify-between items-center"
                  >
                    <div className="truncate mr-2">
                      <span className="font-medium text-[var(--color-text-primary)] block truncate">
                        {cand.name} ({cand.graduation_year})
                      </span>
                      <Text variant="secondary" className="text-xs truncate">
                        {cand.current_employer ||
                          cand.designation ||
                          "Practitioner"}
                      </Text>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {cand.willing_to_mentor && (
                        <Badge
                          variant="default"
                          size="sm"
                          className="text-[10px]"
                        >
                          Mentor
                        </Badge>
                      )}
                      {cand.willing_to_refer && (
                        <Badge
                          variant="default"
                          size="sm"
                          className="text-[10px]"
                        >
                          Referral
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Alumni Table */}
        <Card padding="none" className="border overflow-hidden">
          <div className="p-4 border-b bg-[var(--color-surface-hover)] flex justify-between items-center">
            <Text className="text-sm font-semibold text-[var(--color-text-primary)]">
              Scoped Alumni Roster ({alumni.length})
            </Text>
          </div>

          {error ? (
            <div className="p-6 text-sm text-red-600 text-center">
              Failed to load scoped alumni records: {error.message}
            </div>
          ) : alumni.length === 0 ? (
            <div className="p-12 text-center text-sm text-[var(--color-text-secondary)]">
              No alumni records found within your scoped cohort authority.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-[var(--color-surface-hover)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                    <th className="py-3 px-4">Alumnus Name</th>
                    <th className="py-3 px-4">Cohort</th>
                    <th className="py-3 px-4">Employer / Organization</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Status &amp; Verification</th>
                    <th className="py-3 px-4">Engagement</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {alumni.map((alum) => (
                    <tr
                      key={alum.alumni_id}
                      className="hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-[var(--color-text-primary)]">
                        {alum.student_name}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] whitespace-nowrap">
                        Class of {alum.graduation_year} &bull;{" "}
                        {alum.program_code}
                      </td>
                      <td className="py-3 px-4">
                        {alum.company_name ? (
                          <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                            <span>✓</span> {alum.company_name}
                          </span>
                        ) : alum.current_organization ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {alum.current_organization} (Unmatched)
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)] italic">
                            Not specified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {alum.current_role || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {alum.last_verified_at ? (
                            <Badge
                              variant="default"
                              size="sm"
                              className="bg-emerald-600 text-white w-fit"
                            >
                              Verified
                            </Badge>
                          ) : (
                            <Badge
                              variant="default"
                              size="sm"
                              className="w-fit text-amber-600 border-amber-300"
                            >
                              Unverified
                            </Badge>
                          )}
                          {alum.public_alumni_enabled && (
                            <Badge
                              variant="default"
                              size="sm"
                              className="w-fit text-[10px]"
                            >
                              Public Directory
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {alum.willing_to_mentor && (
                            <Badge
                              variant="default"
                              size="sm"
                              className="text-[10px]"
                            >
                              Mentor
                            </Badge>
                          )}
                          {alum.willing_to_refer && (
                            <Badge
                              variant="default"
                              size="sm"
                              className="text-[10px]"
                            >
                              Referrals
                            </Badge>
                          )}
                          {alum.willing_to_support_placement && (
                            <Badge
                              variant="default"
                              size="sm"
                              className="text-[10px]"
                            >
                              Placements
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link href={`/staff/alumni/${alum.profile_id}`}>
                          <Button variant="secondary" size="sm">
                            Inspect &rarr;
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Container>
    </div>
  );
}

import React from "react";
import Link from "next/link";
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
  title: "Staff Dashboard",
  description: "Training & Placement staff dashboard shell.",
};

export default async function StaffDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_active, coordinator_slot")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["TNP_COORDINATOR", "TNP_SECRETARY", "SUPER_ADMIN"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  // Fetch coordinator scopes if applicable
  const { data: scopes } = await supabase
    .from("coordinator_student_scopes")
    .select("program_id, batch, granted_at");

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" size="sm">
                  Staff Portal
                </Badge>
                <Badge variant="warning" size="sm">
                  {profile.role}
                </Badge>
                {profile.coordinator_slot && (
                  <Badge variant="info" size="sm">
                    {profile.coordinator_slot}
                  </Badge>
                )}
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Staff Dashboard: {profile.display_name}
              </Heading>
              <Text variant="secondary" className="text-sm">
                Training & Placement Cell — Department of Architecture &
                Planning
              </Text>
            </div>

            <form action={submitSignOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign Out
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="md">
              <Heading level={3} className="text-base mb-1">
                Assigned Scopes
              </Heading>
              <Text variant="secondary" className="text-xs mb-3">
                Coordinators are strictly restricted to assigned batch scopes
                via RLS.
              </Text>

              {scopes && scopes.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)] text-sm">
                  {scopes.map((scope, idx) => (
                    <li
                      key={idx}
                      className="py-2 flex items-center justify-between"
                    >
                      <span className="font-medium">Batch: {scope.batch}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Program ID: {scope.program_id.slice(0, 8)}...
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {profile.role === "TNP_COORDINATOR"
                    ? "No student batch scopes have been assigned yet by the Super Admin."
                    : "Super Admin and Secretary possess department-wide administrative scope."}
                </p>
              )}
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Student Directory
                </Heading>
                <Badge variant="default" size="sm">
                  Active
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Access student rosters, view detailed professional profiles, and
                inspect verified academic standing.
              </Text>
              <Link href="/staff/students">
                <Button variant="primary" size="sm" className="w-full">
                  Open Student Directory →
                </Button>
              </Link>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Skills Catalog
                </Heading>
                <Badge variant="info" size="sm">
                  Catalog
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Manage the department-approved skills catalog. Super Admin and
                Secretary can create and modify skills; Coordinators have
                read-only access.
              </Text>
              <Link href="/staff/skills">
                <Button variant="secondary" size="sm" className="w-full">
                  Manage Skills Catalog →
                </Button>
              </Link>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Skill Review Queue
                </Heading>
                <Badge variant="warning" size="sm">
                  Reviews
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Review student skill claims and audit attached portfolio links
                or PDF evidence within your scoped batch authority.
              </Text>
              <Link href="/staff/skills/reviews">
                <Button variant="primary" size="sm" className="w-full">
                  Open Verification Queue →
                </Button>
              </Link>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Placement Drives
                </Heading>
                <Badge variant="info" size="sm">
                  Drives &amp; Eligibility
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Create and manage placement &amp; internship drives, configure
                authoritative eligibility thresholds, target student cohorts,
                and grant recruiter access.
              </Text>
              <Link href="/staff/drives">
                <Button variant="primary" size="sm" className="w-full">
                  Manage Placement Drives →
                </Button>
              </Link>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Application Review
                </Heading>
                <Badge variant="info" size="sm">
                  Workflow
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Review candidate applications, execute status transitions, and
                inspect append-only audit histories within your assigned scope.
              </Text>
              <Link href="/staff/applications">
                <Button variant="primary" size="sm" className="w-full">
                  Review Applications →
                </Button>
              </Link>
            </Card>

            {profile.role === "SUPER_ADMIN" && (
              <Card padding="md">
                <div className="flex items-center justify-between mb-1">
                  <Heading level={3} className="text-base">
                    Terminal Recovery
                  </Heading>
                  <Badge variant="danger" size="sm">
                    Super Admin
                  </Badge>
                </div>
                <Text variant="secondary" className="text-xs mb-4">
                  Authoritatively reverse terminal states (SELECTED, REJECTED,
                  WITHDRAWN) to prior non-terminal standing with mandatory
                  justification.
                </Text>
                <Link href="/admin/recovery">
                  <Button variant="destructive" size="sm" className="w-full">
                    Terminal Recovery Portal →
                  </Button>
                </Link>
              </Card>
            )}

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Companies Directory
                </Heading>
                <Badge variant="default" size="sm">
                  CRM
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Manage canonical recruiting entities, maintain corporate
                profiles, and configure industry partner relationships.
              </Text>
              <Link href="/staff/companies">
                <Button variant="secondary" size="sm" className="w-full">
                  Manage Companies →
                </Button>
              </Link>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-1">
                <Heading level={3} className="text-base">
                  Recruiter Management
                </Heading>
                <Badge variant="info" size="sm">
                  Invitations
                </Badge>
              </div>
              <Text variant="secondary" className="text-xs mb-4">
                Maintain corporate contact records, issue 7-day portal
                invitations, and manage recruiter account onboarding.
              </Text>
              <Link href="/staff/recruiters">
                <Button variant="primary" size="sm" className="w-full">
                  Manage Recruiters →
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

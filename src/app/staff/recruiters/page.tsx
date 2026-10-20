import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RecruitersClient } from "./RecruitersClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Recruiter Contacts | Staff Portal",
  description:
    "Recruiter contacts directory, invitations, and onboarding management.",
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    companyId?: string;
    active?: string;
    invStatus?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 20;

export default async function StaffRecruitersPage({ searchParams }: PageProps) {
  const {
    search = "",
    companyId = "",
    active = "all",
    invStatus = "all",
    page = "1",
  } = await searchParams;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/recruiters");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  const isStaff =
    profile &&
    profile.is_active &&
    ["SUPER_ADMIN", "TNP_SECRETARY", "TNP_COORDINATOR"].includes(profile.role);

  if (!isStaff) {
    redirect("/unauthorized");
  }

  const canManage = ["SUPER_ADMIN", "TNP_SECRETARY"].includes(profile.role);

  // Fetch active companies for filter and creation dropdowns
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, is_archived")
    .order("name", { ascending: true });

  // Query recruiter contacts view with lookahead
  let query = supabase
    .from("v_staff_recruiter_contacts")
    .select("*")
    .order("full_name", { ascending: true })
    .range(offset, offset + PAGE_SIZE);

  if (search.trim()) {
    query = query.or(
      `full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
    );
  }

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  if (active === "true") {
    query = query.eq("is_active", true);
  } else if (active === "false") {
    query = query.eq("is_active", false);
  }

  if (invStatus && invStatus !== "all") {
    query = query.eq("computed_invitation_status", invStatus.toUpperCase());
  }

  const { data: rawContacts, error } = await query;
  if (error) {
    console.error("Error fetching recruiter contacts:", error);
  }

  const items = rawContacts || [];
  const hasNextPage = items.length > PAGE_SIZE;
  const contacts = items.slice(0, PAGE_SIZE);

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/dashboard"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  &larr; Staff Dashboard
                </Link>
                <span className="text-[var(--color-border)]">|</span>
                <Badge variant="default" size="sm">
                  Recruiters
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Recruiter Contacts & Invitations
              </Heading>
              <Text variant="secondary" className="text-sm">
                Industry representatives, CRM contact records, and portal
                invitation workflows.
              </Text>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/staff/companies">
                <Button variant="secondary" size="sm">
                  Companies Directory &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <RecruitersClient
            initialContacts={contacts || []}
            companies={companies || []}
            canManage={canManage}
            search={search}
            companyId={companyId}
            active={active}
            invStatus={invStatus}
            currentPage={currentPage}
            hasNextPage={hasNextPage}
          />
        </div>
      </Container>
    </div>
  );
}

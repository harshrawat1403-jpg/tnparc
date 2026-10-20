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
import { CompaniesClient } from "./CompaniesClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Companies Directory | Staff Portal",
  description: "Canonical companies directory and management.",
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 20;

export default async function StaffCompaniesPage({ searchParams }: PageProps) {
  const { search = "", status = "active", page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/companies");
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

  // Build query with RLS enforcement
  let query = supabase
    .from("companies")
    .select(
      "id, name, normalized_name, website, description, is_archived, created_at, updated_at"
    )
    .order("name", { ascending: true })
    .range(offset, offset + PAGE_SIZE); // Fetch 21 rows for lookahead

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  if (status === "active") {
    query = query.eq("is_archived", false);
  } else if (status === "archived") {
    query = query.eq("is_archived", true);
  }

  const { data: rawCompanies, error } = await query;
  if (error) {
    console.error("Error fetching companies:", error);
  }

  const items = rawCompanies || [];
  const hasNextPage = items.length > PAGE_SIZE;
  const companies = items.slice(0, PAGE_SIZE);

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
                  Companies
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                Canonical Companies Directory
              </Heading>
              <Text variant="secondary" className="text-sm">
                Industry partners, canonical entities, and recruiting
                organizations.
              </Text>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/staff/recruiters">
                <Button variant="secondary" size="sm">
                  Recruiter Contacts &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <CompaniesClient
            initialCompanies={companies}
            canManage={canManage}
            search={search}
            status={status}
            currentPage={currentPage}
            hasNextPage={hasNextPage}
          />
        </div>
      </Container>
    </div>
  );
}

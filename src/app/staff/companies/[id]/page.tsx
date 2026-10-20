import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CompanyDetailClient } from "./CompanyDetailClient";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", id)
    .single();

  return {
    title: company ? `${company.name} | Staff Portal` : "Company Details",
    description: "Canonical company details and associated recruiter contacts.",
  };
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/companies/${id}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
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

  // Fetch company
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .select(
      "id, name, normalized_name, website, description, is_archived, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (compErr || !company) {
    notFound();
  }

  // Fetch recruiter contacts associated with this company via overview view
  const { data: contacts } = await supabase
    .from("v_staff_recruiter_contacts")
    .select("*")
    .eq("company_id", id)
    .order("full_name", { ascending: true });

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/staff/companies"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  &larr; Companies Directory
                </Link>
                <span className="text-[var(--color-border)]">|</span>
                <Badge
                  variant={company.is_archived ? "danger" : "success"}
                  size="sm"
                >
                  {company.is_archived ? "Archived" : "Active"}
                </Badge>
              </div>
              <Heading level={1} className="text-2xl sm:text-3xl">
                {company.name}
              </Heading>
              <Text variant="secondary" className="text-sm">
                Normalized identifier:{" "}
                <span className="font-mono text-xs">
                  {company.normalized_name}
                </span>
              </Text>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/staff/recruiters">
                <Button variant="secondary" size="sm">
                  All Recruiters &rarr;
                </Button>
              </Link>
            </div>
          </div>

          <CompanyDetailClient
            company={company}
            contacts={contacts || []}
            canManage={canManage}
          />
        </div>
      </Container>
    </div>
  );
}

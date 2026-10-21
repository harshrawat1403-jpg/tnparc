import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { CreateDriveForm } from "./CreateDriveForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Create Placement Drive | Staff Portal",
  description: "Initiate a new placement or internship drive in DRAFT status.",
};

export default async function CreateDrivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/drives/new");
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

  // Fetch active unarchived companies
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching companies:", error);
  }

  const activeCompanies = companies || [];

  return (
    <div className="py-10">
      <Container size="md">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="pb-6 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/staff/drives"
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                &larr; Back to Placement Drives
              </Link>
            </div>
            <Heading level={1} className="text-2xl font-bold">
              Create New Placement Drive
            </Heading>
            <Text className="text-sm text-[var(--color-text-secondary)] mt-1">
              Drives are created in DRAFT status. You will configure eligibility
              criteria and eligible cohorts next.
            </Text>
          </div>

          <CreateDriveForm companies={activeCompanies} />
        </div>
      </Container>
    </div>
  );
}

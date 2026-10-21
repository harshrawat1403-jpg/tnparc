import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { DrivesListClient } from "./DrivesListClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Placement Drives | Staff Portal",
  description:
    "Manage placement and internship drives, criteria, and recruiter access.",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export default async function StaffDrivesPage({ searchParams }: PageProps) {
  const { status = "all", search = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/drives");
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

  let query = supabase
    .from("v_staff_drives")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq(
      "status",
      status.toUpperCase() as "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
    );
  }

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data: drives, error } = await query;
  if (error) {
    console.error("Error fetching staff drives:", error);
  }

  const driveList = (drives || []) as unknown as Parameters<
    typeof DrivesListClient
  >[0]["drives"];
  const canPublishOrClose = ["SUPER_ADMIN", "TNP_SECRETARY"].includes(
    profile.role
  );

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
              </div>
              <Heading level={1} className="text-2xl font-bold">
                Placement &amp; Internship Drives
              </Heading>
              <Text className="text-sm text-[var(--color-text-secondary)] mt-1">
                Configure eligibility criteria, cohort targeting, and recruiter
                access.
              </Text>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/staff/drives/new">
                <Button variant="primary">Create New Drive</Button>
              </Link>
            </div>
          </div>

          <DrivesListClient
            drives={driveList}
            initialStatus={status}
            initialSearch={search}
            canPublishOrClose={canPublishOrClose}
          />
        </div>
      </Container>
    </div>
  );
}

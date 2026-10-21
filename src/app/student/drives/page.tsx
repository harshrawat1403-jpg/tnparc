import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { StudentDrivesClient } from "./StudentDrivesClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Placement & Internship Drives | Student Portal",
  description:
    "Browse published campus placement and internship opportunities.",
};

interface PageProps {
  searchParams: Promise<{
    type?: string;
    search?: string;
  }>;
}

export default async function StudentDrivesPage({ searchParams }: PageProps) {
  const { type = "all", search = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/student/drives");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  const isStudent = profile && profile.role === "STUDENT" && profile.is_active;

  if (!isStudent) {
    redirect("/unauthorized");
  }

  // Fetch published drives via safe projection view (RLS enforced)
  let query = supabase
    .from("v_student_published_drives")
    .select("*")
    .order("published_at", { ascending: false });

  if (type !== "all") {
    query = query.eq(
      "drive_type",
      type.toUpperCase() as "PLACEMENT" | "INTERNSHIP"
    );
  }

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data: drives, error } = await query;
  if (error) {
    console.error("Error fetching student drives:", error);
  }

  const driveList = (drives || []) as unknown as Parameters<
    typeof StudentDrivesClient
  >[0]["drives"];

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="pb-6 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/student/dashboard"
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                &larr; Student Dashboard
              </Link>
            </div>
            <Heading level={1} className="text-2xl font-bold">
              Placement &amp; Internship Opportunities
            </Heading>
            <Text className="text-sm text-[var(--color-text-secondary)] mt-1">
              Browse verified drives published by the Department Training &amp;
              Placement Cell.
            </Text>
          </div>

          <StudentDrivesClient
            drives={driveList}
            initialType={type}
            initialSearch={search}
          />
        </div>
      </Container>
    </div>
  );
}

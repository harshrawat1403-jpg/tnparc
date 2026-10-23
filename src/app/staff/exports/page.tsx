import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffExportsClient } from "./StaffExportsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Data Exports | Staff Portal",
  description:
    "Generate and download bounded institutional data exports in CSV format for administrative operations.",
};

export default async function StaffExportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/exports");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, display_name")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !profile.is_active ||
    !["SUPER_ADMIN", "TNP_SECRETARY"].includes(profile.role)
  ) {
    redirect("/unauthorized");
  }

  // Fetch reference metadata for filters
  const [programsRes, drivesRes] = await Promise.all([
    supabase
      .from("academic_programs")
      .select("id, code, display_name")
      .order("code", { ascending: true }),
    supabase
      .from("placement_drives")
      .select("id, title, drive_type, published_at")
      .neq("status", "DRAFT")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  const programs = programsRes.data || [];
  const drives = drivesRes.data || [];

  return (
    <StaffExportsClient
      programs={programs}
      drives={drives}
      userRole={profile.role}
    />
  );
}

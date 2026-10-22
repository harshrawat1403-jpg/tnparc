import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { AlumnusDetailClient } from "./AlumnusDetailClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Alumnus Detail & Verification | VNIT Staff",
  description:
    "Inspect alumnus profile, match corporate entities, and verify credentials.",
};

interface AlumnusDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AlumnusDetailPage({
  params,
}: AlumnusDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/staff/alumni/${id}`);
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

  // Fetch alumnus record from staff scoped view (by profile_id or alumni_id)
  const { data: alumnusData, error } = await supabase
    .from("v_staff_alumni_directory")
    .select("*")
    .or(`profile_id.eq.${id},alumni_id.eq.${id}`)
    .maybeSingle();

  if (error || !alumnusData || !alumnusData.alumni_id) {
    notFound();
  }

  // Fetch employment history from scoped view
  const { data: employmentData } = await supabase
    .from("v_staff_alumni_employment_history")
    .select(
      "employment_id, organization, role, started_at, ended_at, city, country, notes, company_name"
    )
    .eq("alumni_id", alumnusData.alumni_id)
    .order("started_at", { ascending: false });

  // Fetch registered companies for matching
  const { data: companiesData } = await supabase
    .from("companies")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  return (
    <div className="py-10">
      <Container size="lg">
        <div className="pb-6 border-b border-[var(--color-border)] mb-8">
          <Link
            href="/staff/alumni"
            className="text-xs text-[var(--color-text-secondary)] hover:underline mb-2 block"
          >
            &larr; Back to Alumni Directory
          </Link>
          <Heading
            level={1}
            className="text-2xl sm:text-3xl font-bold tracking-tight"
          >
            Alumnus Profile &amp; Verification
          </Heading>
        </div>

        <AlumnusDetailClient
          alumnus={alumnusData}
          employmentHistory={employmentData || []}
          companies={companiesData || []}
        />
      </Container>
    </div>
  );
}

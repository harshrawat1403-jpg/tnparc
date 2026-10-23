import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffStatisticsClient } from "./StaffStatisticsClient";

export const instant = false;

export const metadata: Metadata = {
  title: "Placement Statistics & Analytics | Staff Portal",
  description:
    "Authoritative department placement statistics, drive trends, recruiter retention, and conversion analytics.",
};

export default async function StaffStatisticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/statistics");
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

  // Load server-first authoritative statistics
  const [
    drivesStatsRes,
    conversionStatsRes,
    companiesYearRes,
    repeatRecruitersRes,
    internshipConvRes,
    alumniCompanyRes,
    alumniYearRes,
  ] = await Promise.all([
    supabase.rpc("get_staff_drive_statistics"),
    supabase.rpc("get_staff_conversion_statistics", { p_limit: 50 }),
    supabase.rpc("get_staff_companies_by_year", { p_limit: 50 }),
    supabase.rpc("get_staff_repeat_recruiters"),
    supabase.rpc("get_staff_internship_placement_conversion"),
    supabase.rpc("get_staff_alumni_by_company"),
    supabase.rpc("get_staff_alumni_by_year"),
  ]);

  const driveStats = drivesStatsRes.data || [];
  const conversionStats = conversionStatsRes.data || [];
  const companiesByYear = companiesYearRes.data || [];
  const repeatRecruiters = repeatRecruitersRes.data || [];
  const internshipConversion =
    internshipConvRes.data && internshipConvRes.data[0]
      ? internshipConvRes.data[0]
      : {
          total_internship_selected: 0,
          converted_to_placement: 0,
          conversion_rate_pct: 0,
        };
  const alumniByCompany = alumniCompanyRes.data || [];
  const alumniByYear = alumniYearRes.data || [];

  return (
    <StaffStatisticsClient
      driveStats={driveStats}
      conversionStats={conversionStats}
      companiesByYear={companiesByYear}
      repeatRecruiters={repeatRecruiters}
      internshipConversion={internshipConversion}
      alumniByCompany={alumniByCompany}
      alumniByYear={alumniByYear}
      userRole={profile.role}
    />
  );
}

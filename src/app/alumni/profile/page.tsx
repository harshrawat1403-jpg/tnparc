import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { AlumniProfileForm } from "./AlumniProfileForm";

export const instant = false;

export const metadata: Metadata = {
  title: "My Alumni Profile | VNIT Nagpur",
  description:
    "Manage your professional alumni identity, industry engagement, and directory privacy settings.",
};

export default async function AlumniProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/alumni/profile");
  }

  // Fetch user profile and check lifecycle status
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, is_active, student_lifecycle_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.student_lifecycle_status !== "ALUMNI") {
    return (
      <div className="py-16">
        <Container size="md">
          <Card padding="lg" className="text-center py-12 border">
            <Heading level={2} className="text-2xl font-bold mb-3">
              Alumni Portal Access Restricted
            </Heading>
            <Text variant="secondary" className="text-sm max-w-md mx-auto mb-6">
              This portal is exclusively available to graduates who have
              completed the graduation and alumni transition process with the
              VNIT Training & Placement Cell.
            </Text>
            <Text variant="secondary" className="text-xs">
              Current account status:{" "}
              {profile?.student_lifecycle_status || "UNKNOWN"}
            </Text>
          </Card>
        </Container>
      </div>
    );
  }

  // Fetch alumni_profiles row
  const { data: alumniProfileData, error: alumniError } = await supabase
    .from("alumni_profiles")
    .select(
      `
      id,
      graduation_year,
      program_id,
      current_organization,
      company_id,
      "current_role",
      professional_domain,
      city,
      country,
      linkedin_url,
      higher_studies_institution,
      higher_studies_program,
      higher_studies_year_start,
      willing_to_mentor,
      willing_to_refer,
      willing_to_support_placement,
      public_alumni_enabled,
      consent_recorded_at,
      last_verified_at,
      academic_programs (
        code,
        display_name
      ),
      companies (
        name
      )
    `
    )
    .eq("profile_id", user.id)
    .single();

  if (alumniError || !alumniProfileData) {
    return (
      <div className="py-16">
        <Container size="md">
          <Card padding="lg" className="text-center py-12 border">
            <Heading level={2} className="text-xl font-bold mb-3">
              Alumni Record Not Found
            </Heading>
            <Text variant="secondary" className="text-sm">
              Your profile indicates alumni status, but your alumni record could
              not be loaded. Please contact the Training & Placement Cell.
            </Text>
          </Card>
        </Container>
      </div>
    );
  }

  // Fetch alumni employment history
  const { data: employmentData } = await supabase
    .from("alumni_employment_history")
    .select(
      "id, organization, role, started_at, ended_at, professional_domain, city, country, notes"
    )
    .eq("alumni_id", alumniProfileData.id)
    .order("started_at", { ascending: false });

  // Map joined program and company
  const program = alumniProfileData.academic_programs as unknown as {
    code: string;
    display_name: string;
  } | null;
  const matchedCompany = alumniProfileData.companies as unknown as {
    name: string;
  } | null;

  const transformedProfile = {
    id: alumniProfileData.id,
    graduation_year: alumniProfileData.graduation_year,
    program_code: program?.code || "DEPT",
    program_name: program?.display_name || "Architecture & Planning",
    company_id: alumniProfileData.company_id,
    company_name: matchedCompany?.name || null,
    current_organization: alumniProfileData.current_organization,
    current_role: alumniProfileData.current_role,
    professional_domain: alumniProfileData.professional_domain,
    city: alumniProfileData.city,
    country: alumniProfileData.country,
    linkedin_url: alumniProfileData.linkedin_url,
    higher_studies_institution: alumniProfileData.higher_studies_institution,
    higher_studies_program: alumniProfileData.higher_studies_program,
    higher_studies_year_start: alumniProfileData.higher_studies_year_start,
    willing_to_mentor: alumniProfileData.willing_to_mentor,
    willing_to_refer: alumniProfileData.willing_to_refer,
    willing_to_support_placement:
      alumniProfileData.willing_to_support_placement,
    public_alumni_enabled: alumniProfileData.public_alumni_enabled,
    consent_recorded_at: alumniProfileData.consent_recorded_at,
    last_verified_at: alumniProfileData.last_verified_at,
  };

  return (
    <div className="py-12">
      <Container size="md">
        <div className="mb-8">
          <Heading
            level={1}
            className="text-2xl sm:text-3xl font-bold tracking-tight"
          >
            Alumni Professional Profile
          </Heading>
          <Text variant="secondary" className="text-sm mt-1">
            Keep your professional coordinates updated to engage with the VNIT
            student community and appear in the verified public alumni
            directory.
          </Text>
        </div>

        <AlumniProfileForm
          profile={transformedProfile}
          employmentHistory={employmentData || []}
        />
      </Container>
    </div>
  );
}

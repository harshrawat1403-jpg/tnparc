"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult<T = unknown> {
  success?: string;
  error?: string;
  data?: T;
}

export interface ConvertStudentToAlumniPayload {
  currentOrganization?: string | null;
  companyId?: string | null;
  currentRole?: string | null;
  professionalDomain?: string | null;
  city?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  reason?: string | null;
}

export interface UpdateAlumniProfilePayload {
  currentOrganization?: string | null;
  companyId?: string | null;
  currentRole?: string | null;
  professionalDomain?: string | null;
  city?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  higherStudiesInstitution?: string | null;
  higherStudiesProgram?: string | null;
  higherStudiesYearStart?: number | null;
  willingToMentor?: boolean;
  willingToRefer?: boolean;
  willingToSupportPlacement?: boolean;
  publicAlumniEnabled?: boolean;
}

export interface AddEmploymentPayload {
  organization: string;
  role: string;
  startedAt: string;
  endedAt?: string | null;
  companyId?: string | null;
  professionalDomain?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
}

/**
 * Staff: Mark active student graduated
 */
export async function markStudentGraduatedAction(
  studentId: string,
  reason: string
): Promise<ActionResult> {
  if (!studentId || !studentId.trim()) {
    return { error: "Student ID is required." };
  }
  if (!reason || !reason.trim()) {
    return { error: "Reason for graduation is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_student_graduated", {
    p_student_id: studentId.trim(),
    p_reason: reason.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/alumni");
  revalidatePath("/staff/alumni/graduation");
  revalidatePath(`/staff/students/${studentId}`);

  return {
    success: "Student marked as graduated successfully.",
    data,
  };
}

/**
 * Staff: Convert graduated student to alumni
 */
export async function convertStudentToAlumniAction(
  studentId: string,
  payload: ConvertStudentToAlumniPayload
): Promise<ActionResult> {
  if (!studentId || !studentId.trim()) {
    return { error: "Student ID is required." };
  }

  // Matched vs unmatched employer rule:
  // If companyId is provided, currentOrganization MUST be null
  const companyId = payload.companyId?.trim() || null;
  const currentOrg = companyId
    ? null
    : payload.currentOrganization?.trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_student_to_alumni", {
    p_student_id: studentId.trim(),
    p_current_organization: currentOrg || undefined,
    p_company_id: companyId || undefined,
    p_current_role: payload.currentRole?.trim() || undefined,
    p_professional_domain: payload.professionalDomain?.trim() || undefined,
    p_city: payload.city?.trim() || undefined,
    p_country: payload.country?.trim() || "India",
    p_linkedin_url: payload.linkedinUrl?.trim() || undefined,
    p_reason:
      payload.reason?.trim() || "Student graduated and transitioned to alumni",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/alumni");
  revalidatePath("/staff/alumni/graduation");
  revalidatePath(`/staff/alumni/${studentId}`);
  revalidatePath("/alumni");

  return {
    success: "Student converted to alumni successfully.",
    data,
  };
}

/**
 * Alumni: Update own profile and privacy toggles
 */
export async function updateOwnAlumniProfileAction(
  payload: UpdateAlumniProfilePayload
): Promise<ActionResult> {
  const companyId = payload.companyId?.trim() || null;
  const currentOrg = companyId
    ? null
    : payload.currentOrganization?.trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_own_alumni_profile", {
    p_current_organization: currentOrg || undefined,
    p_company_id: companyId || undefined,
    p_current_role: payload.currentRole?.trim() || undefined,
    p_professional_domain: payload.professionalDomain?.trim() || undefined,
    p_city: payload.city?.trim() || undefined,
    p_country: payload.country?.trim() || "India",
    p_linkedin_url: payload.linkedinUrl?.trim() || undefined,
    p_higher_studies_institution:
      payload.higherStudiesInstitution?.trim() || undefined,
    p_higher_studies_program: payload.higherStudiesProgram?.trim() || undefined,
    p_higher_studies_year_start: payload.higherStudiesYearStart || undefined,
    p_willing_to_mentor: !!payload.willingToMentor,
    p_willing_to_refer: !!payload.willingToRefer,
    p_willing_to_support_placement: !!payload.willingToSupportPlacement,
    p_public_alumni_enabled: !!payload.publicAlumniEnabled,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/alumni/profile");
  revalidatePath("/alumni");

  return {
    success: "Alumni profile updated successfully.",
    data,
  };
}

/**
 * Alumni: Add past or current employment history
 */
export async function addOwnAlumniEmploymentAction(
  payload: AddEmploymentPayload
): Promise<ActionResult> {
  if (!payload.organization || !payload.organization.trim()) {
    return { error: "Organization is required." };
  }
  if (!payload.role || !payload.role.trim()) {
    return { error: "Role is required." };
  }
  if (!payload.startedAt) {
    return { error: "Start date is required." };
  }

  const companyId = payload.companyId?.trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_own_alumni_employment", {
    p_organization: payload.organization.trim(),
    p_role: payload.role.trim(),
    p_started_at: payload.startedAt,
    p_ended_at: payload.endedAt || undefined,
    p_company_id: companyId || undefined,
    p_professional_domain: payload.professionalDomain?.trim() || undefined,
    p_city: payload.city?.trim() || undefined,
    p_country: payload.country?.trim() || undefined,
    p_notes: payload.notes?.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/alumni/profile");

  return {
    success: "Employment record added successfully.",
    data,
  };
}

/**
 * Staff: Fetch alumni aggregated by company
 */
export async function getStaffAlumniByCompanyAction(
  limit: number = 50,
  offset: number = 0
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_alumni_by_company", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Staff: Fetch alumni aggregated by graduation year
 */
export async function getStaffAlumniByYearAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_alumni_by_year");

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Staff: Fetch outreach candidates
 */
export async function getStaffAlumniOutreachCandidatesAction(
  preference?: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_staff_alumni_outreach_candidates",
    {
      p_preference: preference || undefined,
      p_limit: limit,
      p_offset: offset,
    }
  );

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Staff: Match unmatched employer text to canonical company
 */
export async function matchAlumniCompanyAction(
  alumniId: string,
  companyId: string,
  reason: string
): Promise<ActionResult> {
  if (!alumniId || !alumniId.trim()) {
    return { error: "Alumni ID is required." };
  }
  if (!companyId || !companyId.trim()) {
    return { error: "Company selection is required." };
  }
  if (!reason || !reason.trim()) {
    return { error: "Reason for matching is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_alumni_company", {
    p_alumni_id: alumniId.trim(),
    p_company_id: companyId.trim(),
    p_reason: reason.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/alumni");
  revalidatePath(`/staff/alumni/${alumniId}`);
  revalidatePath("/alumni");

  return {
    success: "Alumni company matched successfully.",
    data,
  };
}

/**
 * Staff: Verify alumni profile
 */
export async function verifyAlumniProfileAction(
  alumniId: string
): Promise<ActionResult> {
  if (!alumniId || !alumniId.trim()) {
    return { error: "Alumni ID is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_alumni_profile", {
    p_alumni_id: alumniId.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/alumni");
  revalidatePath(`/staff/alumni/${alumniId}`);

  return {
    success: "Alumni profile verified successfully.",
    data,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface DriveActionResult {
  success?: string;
  error?: string;
  driveId?: string;
}

/**
 * Staff (Admin, Secretary, Coordinator): Create a placement or internship drive in DRAFT status
 */
export async function submitCreateDrive(
  prevState: DriveActionResult | null,
  formData: FormData
): Promise<DriveActionResult> {
  const companyId = formData.get("company_id") as string;
  const title = (formData.get("title") as string) || "";
  const driveType = formData.get("drive_type") as "PLACEMENT" | "INTERNSHIP";
  const description = (formData.get("description") as string) || "";
  const location = (formData.get("location") as string) || "";
  const applicationDeadlineStr = formData.get("application_deadline") as string;
  const packageLpaStr = formData.get("package_lpa") as string;
  const stipendMonthlyStr = formData.get("stipend_monthly") as string;
  const compensationDetails =
    (formData.get("compensation_details") as string) || "";
  const requirementsInfo = (formData.get("requirements_info") as string) || "";

  if (!companyId) {
    return { error: "Company selection is required." };
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { error: "Drive title is required." };
  }

  if (cleanTitle.length > 200) {
    return { error: "Drive title cannot exceed 200 characters." };
  }

  if (!driveType || !["PLACEMENT", "INTERNSHIP"].includes(driveType)) {
    return { error: "Valid drive type (PLACEMENT or INTERNSHIP) is required." };
  }

  let applicationDeadline: string | undefined = undefined;
  if (applicationDeadlineStr && applicationDeadlineStr.trim()) {
    const d = new Date(applicationDeadlineStr.trim());
    if (isNaN(d.getTime())) {
      return { error: "Invalid application deadline format." };
    }
    applicationDeadline = d.toISOString();
  }

  let packageLpa: number | undefined = undefined;
  if (packageLpaStr && packageLpaStr.trim()) {
    const val = parseFloat(packageLpaStr);
    if (isNaN(val) || val < 0 || val > 9999.99) {
      return { error: "Package LPA must be between 0 and 9999.99." };
    }
    packageLpa = val;
  }

  let stipendMonthly: number | undefined = undefined;
  if (stipendMonthlyStr && stipendMonthlyStr.trim()) {
    const val = parseFloat(stipendMonthlyStr);
    if (isNaN(val) || val < 0) {
      return { error: "Stipend monthly must be non-negative." };
    }
    stipendMonthly = val;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_placement_drive", {
    p_company_id: companyId,
    p_title: cleanTitle,
    p_drive_type: driveType,
    p_description: description.trim() || undefined,
    p_location: location.trim() || undefined,
    p_application_deadline: applicationDeadline,
    p_package_lpa: packageLpa,
    p_stipend_monthly: stipendMonthly,
    p_compensation_details: compensationDetails.trim() || undefined,
    p_requirements_info: requirementsInfo.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  const res = data as unknown as { success?: boolean; drive_id?: string };
  revalidatePath("/staff/drives");
  return {
    success: "Drive created successfully in DRAFT state.",
    driveId: res?.drive_id,
  };
}

/**
 * Staff (Admin, Secretary, Coordinator): Update details of a DRAFT placement drive
 */
export async function submitUpdateDrive(
  driveId: string,
  prevState: DriveActionResult | null,
  formData: FormData
): Promise<DriveActionResult> {
  const title = (formData.get("title") as string) || "";
  const description = (formData.get("description") as string) || "";
  const location = (formData.get("location") as string) || "";
  const applicationDeadlineStr = formData.get("application_deadline") as string;
  const packageLpaStr = formData.get("package_lpa") as string;
  const stipendMonthlyStr = formData.get("stipend_monthly") as string;
  const compensationDetails =
    (formData.get("compensation_details") as string) || "";
  const requirementsInfo = (formData.get("requirements_info") as string) || "";

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { error: "Drive title is required." };
  }

  if (cleanTitle.length > 200) {
    return { error: "Drive title cannot exceed 200 characters." };
  }

  let applicationDeadline: string | undefined = undefined;
  if (applicationDeadlineStr && applicationDeadlineStr.trim()) {
    const d = new Date(applicationDeadlineStr.trim());
    if (isNaN(d.getTime())) {
      return { error: "Invalid application deadline format." };
    }
    applicationDeadline = d.toISOString();
  }

  let packageLpa: number | undefined = undefined;
  if (packageLpaStr && packageLpaStr.trim()) {
    const val = parseFloat(packageLpaStr);
    if (isNaN(val) || val < 0 || val > 9999.99) {
      return { error: "Package LPA must be between 0 and 9999.99." };
    }
    packageLpa = val;
  }

  let stipendMonthly: number | undefined = undefined;
  if (stipendMonthlyStr && stipendMonthlyStr.trim()) {
    const val = parseFloat(stipendMonthlyStr);
    if (isNaN(val) || val < 0) {
      return { error: "Stipend monthly must be non-negative." };
    }
    stipendMonthly = val;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_placement_drive", {
    p_drive_id: driveId,
    p_title: cleanTitle,
    p_description: description.trim() || undefined,
    p_location: location.trim() || undefined,
    p_application_deadline: applicationDeadline,
    p_package_lpa: packageLpa,
    p_stipend_monthly: stipendMonthly,
    p_compensation_details: compensationDetails.trim() || undefined,
    p_requirements_info: requirementsInfo.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/drives");
  revalidatePath(`/staff/drives/${driveId}`);
  return { success: "Drive updated successfully." };
}

/**
 * Staff (Admin, Secretary, Coordinator): Configure eligibility thresholds on a DRAFT drive
 */
export async function submitConfigureEligibility(
  driveId: string,
  prevState: DriveActionResult | null,
  formData: FormData
): Promise<DriveActionResult> {
  const minCgpaStr = formData.get("minimum_cgpa") as string;
  const maxBacklogsStr = formData.get("maximum_active_backlogs") as string;
  const excludePrior =
    formData.get("exclude_previously_selected_placement") === "true" ||
    formData.get("exclude_previously_selected_placement") === "on";
  const infoReq = (formData.get("informational_requirements") as string) || "";

  const minCgpa = parseFloat(minCgpaStr);
  if (isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10.0) {
    return { error: "Minimum CGPA must be between 0.00 and 10.00." };
  }

  const maxBacklogs = parseInt(maxBacklogsStr, 10);
  if (isNaN(maxBacklogs) || maxBacklogs < 0) {
    return { error: "Maximum active backlogs must be a non-negative integer." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_drive_eligibility", {
    p_drive_id: driveId,
    p_minimum_cgpa: minCgpa,
    p_maximum_active_backlogs: maxBacklogs,
    p_exclude_previously_selected_placement: excludePrior,
    p_informational_requirements: infoReq.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/staff/drives/${driveId}`);
  return { success: "Eligibility criteria configured successfully." };
}

/**
 * Staff (Admin, Secretary, Coordinator): Configure eligible cohorts (program + batch)
 */
export async function submitConfigureEligibleBatches(
  driveId: string,
  batches: Array<{ program_id: string; batch: string }>
): Promise<DriveActionResult> {
  if (!Array.isArray(batches) || batches.length === 0) {
    return { error: "At least one program and batch cohort must be selected." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_drive_eligible_batches", {
    p_drive_id: driveId,
    p_batches: batches,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/staff/drives/${driveId}`);
  return { success: "Eligible cohorts updated successfully." };
}

/**
 * Staff (Super Admin & Secretary): Publish placement drive (DRAFT -> PUBLISHED)
 */
export async function submitPublishDrive(
  driveId: string
): Promise<DriveActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_placement_drive", {
    p_drive_id: driveId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/drives");
  revalidatePath(`/staff/drives/${driveId}`);
  revalidatePath("/student/drives");
  return { success: "Drive published successfully." };
}

/**
 * Staff (Super Admin & Secretary): Close placement drive (PUBLISHED -> CLOSED)
 */
export async function submitCloseDrive(
  driveId: string
): Promise<DriveActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_placement_drive", {
    p_drive_id: driveId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/drives");
  revalidatePath(`/staff/drives/${driveId}`);
  revalidatePath("/student/drives");
  return { success: "Drive closed successfully." };
}

/**
 * Staff (Super Admin & Secretary): Archive placement drive (CLOSED -> ARCHIVED)
 */
export async function submitArchiveDrive(
  driveId: string
): Promise<DriveActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_placement_drive", {
    p_drive_id: driveId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/drives");
  revalidatePath(`/staff/drives/${driveId}`);
  return { success: "Drive archived successfully (terminal state)." };
}

/**
 * Staff (Super Admin & Secretary): Grant recruiter access to drive
 */
export async function submitGrantRecruiterAccess(
  driveId: string,
  recruiterProfileId: string,
  expiresAtStr?: string
): Promise<DriveActionResult> {
  let expiresAt: string | undefined = undefined;
  if (expiresAtStr && expiresAtStr.trim()) {
    const d = new Date(expiresAtStr.trim());
    if (isNaN(d.getTime())) {
      return { error: "Invalid expiry date format." };
    }
    if (d.getTime() <= Date.now()) {
      return { error: "Grant expiry timestamp must be in the future." };
    }
    expiresAt = d.toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_recruiter_drive_access", {
    p_drive_id: driveId,
    p_recruiter_profile_id: recruiterProfileId,
    p_expires_at: expiresAt,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/staff/drives/${driveId}`);
  revalidatePath("/recruiter/drives");
  return { success: "Recruiter drive access granted successfully." };
}

/**
 * Staff (Super Admin & Secretary): Revoke recruiter drive access
 */
export async function submitRevokeRecruiterAccess(
  driveId: string,
  accessGrantId: string
): Promise<DriveActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_recruiter_drive_access", {
    p_access_id: accessGrantId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/staff/drives/${driveId}`);
  revalidatePath("/recruiter/drives");
  return { success: "Recruiter drive access revoked successfully." };
}

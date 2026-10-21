"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ApplicationStatus =
  Database["public"]["Enums"]["application_status"];

export interface ApplicationActionResult {
  success?: string;
  error?: string;
  applicationId?: string;
  status?: ApplicationStatus;
  restoredStatus?: ApplicationStatus;
}

/**
 * Student: Apply to a published drive
 */
export async function applyToDriveAction(
  driveId: string
): Promise<ApplicationActionResult> {
  if (!driveId || !driveId.trim()) {
    return { error: "Drive ID is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_to_drive", {
    p_drive_id: driveId.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    success?: boolean;
    application_id?: string;
    status?: ApplicationStatus;
  };

  revalidatePath("/student/drives");
  revalidatePath(`/student/drives/${driveId}`);
  revalidatePath("/student/applications");
  revalidatePath("/staff/applications");

  return {
    success: "Application submitted successfully.",
    applicationId: result.application_id,
    status: result.status,
  };
}

export async function submitApplyToDrive(
  prevState: ApplicationActionResult | null,
  formData: FormData
): Promise<ApplicationActionResult> {
  const driveId = formData.get("drive_id") as string;
  return applyToDriveAction(driveId);
}

/**
 * Student: Withdraw an existing APPLIED application before the deadline
 */
export async function withdrawApplicationAction(
  applicationId: string,
  reason?: string
): Promise<ApplicationActionResult> {
  if (!applicationId || !applicationId.trim()) {
    return { error: "Application ID is required." };
  }

  const cleanReason = reason?.trim() || undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_application", {
    p_application_id: applicationId.trim(),
    p_reason: cleanReason,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    success?: boolean;
    application_id?: string;
    status?: ApplicationStatus;
  };

  revalidatePath("/student/applications");
  revalidatePath(`/student/applications/${applicationId}`);
  revalidatePath("/student/drives");
  revalidatePath("/staff/applications");
  revalidatePath(`/staff/applications/${applicationId}`);

  return {
    success: "Application withdrawn successfully.",
    applicationId: result.application_id,
    status: result.status,
  };
}

export async function submitWithdrawApplication(
  prevState: ApplicationActionResult | null,
  formData: FormData
): Promise<ApplicationActionResult> {
  const applicationId = formData.get("application_id") as string;
  const reason = (formData.get("reason") as string) || undefined;
  return withdrawApplicationAction(applicationId, reason);
}

/**
 * Staff (Super Admin, TNP Secretary, TNP Coordinator): Transition application status
 */
export async function transitionApplicationStatusAction(
  applicationId: string,
  newStatus: ApplicationStatus,
  reason?: string
): Promise<ApplicationActionResult> {
  if (!applicationId || !applicationId.trim()) {
    return { error: "Application ID is required." };
  }

  if (
    !newStatus ||
    !["SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"].includes(newStatus)
  ) {
    return { error: "Invalid target application status." };
  }

  const cleanReason = reason?.trim() || undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_application_status", {
    p_application_id: applicationId.trim(),
    p_new_status: newStatus,
    p_reason: cleanReason,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    success?: boolean;
    application_id?: string;
    new_status?: ApplicationStatus;
  };

  revalidatePath("/staff/applications");
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath("/staff/drives");
  revalidatePath("/student/applications");
  revalidatePath(`/student/applications/${applicationId}`);

  return {
    success: `Application status transitioned to ${result.new_status}.`,
    applicationId: result.application_id,
    status: result.new_status,
  };
}

export async function submitTransitionApplicationStatus(
  prevState: ApplicationActionResult | null,
  formData: FormData
): Promise<ApplicationActionResult> {
  const applicationId = formData.get("application_id") as string;
  const newStatus = formData.get("new_status") as ApplicationStatus;
  const reason = (formData.get("reason") as string) || undefined;
  return transitionApplicationStatusAction(applicationId, newStatus, reason);
}

/**
 * Super Admin: Correct terminal application status (SELECTED, REJECTED, WITHDRAWN)
 * Restores immediate prior non-terminal status from permanent append-only history.
 */
export async function correctTerminalStatusAction(
  applicationId: string,
  reason: string
): Promise<ApplicationActionResult> {
  if (!applicationId || !applicationId.trim()) {
    return { error: "Application ID is required." };
  }

  const cleanReason = reason?.trim();
  if (!cleanReason) {
    return {
      error:
        "A mandatory, non-empty justification reason is required for terminal correction.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("correct_terminal_status", {
    p_application_id: applicationId.trim(),
    p_reason: cleanReason,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    success?: boolean;
    application_id?: string;
    restored_status?: ApplicationStatus;
  };

  revalidatePath("/staff/applications");
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath("/admin/recovery");
  revalidatePath("/student/applications");
  revalidatePath(`/student/applications/${applicationId}`);

  return {
    success: `Application restored to immediate prior non-terminal status: ${result.restored_status}.`,
    applicationId: result.application_id,
    restoredStatus: result.restored_status,
  };
}

export async function submitCorrectTerminalStatus(
  prevState: ApplicationActionResult | null,
  formData: FormData
): Promise<ApplicationActionResult> {
  const applicationId = formData.get("application_id") as string;
  const reason = (formData.get("reason") as string) || "";
  return correctTerminalStatusAction(applicationId, reason);
}

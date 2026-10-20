"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AcademicVerificationActionState {
  error?: string;
  success?: string;
}

/**
 * Verify Student Academic Record (Secretary / Super Admin Only)
 * Enforces validation bounds and records audit trail without raw CGPA/backlog values.
 */
export async function submitVerifyAcademic(
  _prevState: AcademicVerificationActionState | null,
  formData: FormData
): Promise<AcademicVerificationActionState> {
  const targetProfileId = formData.get("targetProfileId") as string;
  const cgpaRaw = formData.get("cgpa") as string;
  const activeBacklogsRaw = formData.get("activeBacklogs") as string;

  if (!targetProfileId || !cgpaRaw || activeBacklogsRaw === null) {
    return {
      error: "Target student ID, CGPA, and active backlogs count are required.",
    };
  }

  const cgpa = parseFloat(cgpaRaw);
  const activeBacklogs = parseInt(activeBacklogsRaw, 10);

  if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
    return { error: "CGPA must be a valid number between 0.00 and 10.00." };
  }

  if (isNaN(activeBacklogs) || activeBacklogs < 0) {
    return { error: "Active backlogs count must be a non-negative integer." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("verify_student_academic_record", {
    p_target_profile_id: targetProfileId,
    p_cgpa: cgpa,
    p_active_backlogs: activeBacklogs,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/staff/students/${targetProfileId}`);
  revalidatePath("/staff/students");

  return { success: "Academic record successfully verified." };
}

/**
 * Correct Student Academic Record (Secretary / Super Admin Only)
 * Requires mandatory justification reason, audited without raw academic values.
 */
export async function submitCorrectAcademic(
  _prevState: AcademicVerificationActionState | null,
  formData: FormData
): Promise<AcademicVerificationActionState> {
  const targetProfileId = formData.get("targetProfileId") as string;
  const cgpaRaw = formData.get("cgpa") as string;
  const activeBacklogsRaw = formData.get("activeBacklogs") as string;
  const reason = (formData.get("reason") as string) || "";

  if (!targetProfileId || !cgpaRaw || activeBacklogsRaw === null) {
    return {
      error: "Target student ID, CGPA, and active backlogs count are required.",
    };
  }

  if (!reason.trim() || reason.trim().length < 5) {
    return {
      error:
        "A mandatory justification reason (min 5 characters) is required for corrections.",
    };
  }

  const cgpa = parseFloat(cgpaRaw);
  const activeBacklogs = parseInt(activeBacklogsRaw, 10);

  if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
    return { error: "CGPA must be a valid number between 0.00 and 10.00." };
  }

  if (isNaN(activeBacklogs) || activeBacklogs < 0) {
    return { error: "Active backlogs count must be a non-negative integer." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("correct_student_academic_record", {
    p_target_profile_id: targetProfileId,
    p_cgpa: cgpa,
    p_active_backlogs: activeBacklogs,
    p_reason: reason.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/staff/students/${targetProfileId}`);
  revalidatePath("/staff/students");

  return {
    success: "Academic record correction successfully recorded and audited.",
  };
}

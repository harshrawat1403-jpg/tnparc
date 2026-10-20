"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SkillActionState {
  error?: string;
  success?: string;
}

/**
 * Super Admin & Secretary: Create a new skill in the catalog
 */
export async function submitCreateSkill(
  _prevState: SkillActionState | null,
  formData: FormData
): Promise<SkillActionState> {
  const name = (formData.get("name") as string) || "";
  const category = (formData.get("category") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!name.trim()) {
    return { error: "Skill name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_skill", {
    p_name: name.trim(),
    p_category: category.trim() || undefined,
    p_description: description.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/skills");
  return { success: "Skill created successfully in catalog." };
}

/**
 * Super Admin & Secretary: Update skill in catalog
 */
export async function submitUpdateSkill(
  _prevState: SkillActionState | null,
  formData: FormData
): Promise<SkillActionState> {
  const skillId = (formData.get("skillId") as string) || "";
  const name = (formData.get("name") as string) || "";
  const category = (formData.get("category") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!skillId) {
    return { error: "Skill ID is required." };
  }
  if (!name.trim()) {
    return { error: "Skill name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_skill", {
    p_skill_id: skillId,
    p_name: name.trim(),
    p_category: category.trim() || undefined,
    p_description: description.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/skills");
  return { success: "Skill updated successfully." };
}

/**
 * Super Admin & Secretary: Deactivate skill in catalog
 */
export async function submitDeactivateSkill(
  skillId: string
): Promise<SkillActionState> {
  if (!skillId) {
    return { error: "Skill ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_skill", {
    p_skill_id: skillId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/skills");
  return { success: "Skill deactivated successfully." };
}

/**
 * Super Admin & Secretary: Reactivate skill in catalog
 */
export async function submitReactivateSkill(
  skillId: string
): Promise<SkillActionState> {
  if (!skillId) {
    return { error: "Skill ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_skill", {
    p_skill_id: skillId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/skills");
  return { success: "Skill reactivated successfully." };
}

/**
 * Student: Claim an active skill from the catalog
 */
export async function submitClaimSkill(
  _prevState: SkillActionState | null,
  formData: FormData
): Promise<SkillActionState> {
  const skillId = (formData.get("skillId") as string) || "";
  const proficiencyStr = (formData.get("proficiencyLevel") as string) || "1";
  const proficiency = parseInt(proficiencyStr, 10);

  if (!skillId) {
    return { error: "Please select a skill." };
  }
  if (isNaN(proficiency) || proficiency < 1 || proficiency > 4) {
    return { error: "Proficiency level must be between 1 and 4." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_student_skill", {
    p_skill_id: skillId,
    p_proficiency_level: proficiency,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/student/skills");
  return { success: "Skill claimed successfully. Status: PENDING review." };
}

/**
 * Student: Update proficiency of an unverified claim
 */
export async function submitUpdateProficiency(
  studentSkillId: string,
  level: number
): Promise<SkillActionState> {
  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }
  if (level < 1 || level > 4) {
    return { error: "Proficiency level must be between 1 and 4." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_student_skill_proficiency", {
    p_student_skill_id: studentSkillId,
    p_proficiency_level: level,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/student/skills");
  return { success: "Proficiency level updated." };
}

/**
 * Student: Archive a skill claim (frees an active slot)
 */
export async function submitArchiveSkill(
  studentSkillId: string
): Promise<SkillActionState> {
  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_student_skill", {
    p_student_skill_id: studentSkillId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/student/skills");
  return { success: "Skill archived. An active skill slot has been freed." };
}

/**
 * Student: Resubmit a rejected skill claim with evidence
 */
export async function submitResubmitSkill(
  studentSkillId: string
): Promise<SkillActionState> {
  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_student_skill", {
    p_student_skill_id: studentSkillId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/student/skills");
  return { success: "Skill resubmitted for verification." };
}

/**
 * Student: Submit project link evidence
 */
export async function submitSkillLinkEvidence(
  _prevState: SkillActionState | null,
  formData: FormData
): Promise<SkillActionState> {
  const studentSkillId = (formData.get("studentSkillId") as string) || "";
  const evidenceUrl = (formData.get("evidenceUrl") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }
  if (!evidenceUrl.trim()) {
    return { error: "Evidence URL is required." };
  }

  const supabase = await createClient();

  // Inspect existing evidence before update to prevent storage leak if replacing a PDF
  const { data: prevEvidence } = await supabase
    .from("student_skill_evidence")
    .select("evidence_type, storage_path")
    .eq("student_skill_id", studentSkillId)
    .maybeSingle();

  const oldStoragePath =
    prevEvidence?.evidence_type === "PDF_DOCUMENT" && prevEvidence?.storage_path
      ? prevEvidence.storage_path
      : null;

  const { error } = await supabase.rpc("submit_skill_evidence_link", {
    p_student_skill_id: studentSkillId,
    p_evidence_url: evidenceUrl.trim(),
    p_description: description.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  // If replacing a prior PDF evidence, delete the old storage object with admin client
  if (oldStoragePath) {
    try {
      const adminClient = createAdminClient();
      await adminClient.storage.from("skill-evidence").remove([oldStoragePath]);
    } catch {
      // Best-effort cleanup
    }
  }

  revalidatePath("/student/skills");
  return { success: "Project link evidence submitted successfully." };
}

/**
 * Student: Submit PDF skill evidence
 * Enforces magic bytes (%PDF), 5MB size limit, server-side admin upload, compensating delete on failure,
 * and cleanup of prior replaced PDF evidence.
 */
export async function submitSkillPdfEvidence(
  formData: FormData
): Promise<SkillActionState> {
  const studentSkillId = (formData.get("studentSkillId") as string) || "";
  const description = (formData.get("description") as string) || "";
  const file = formData.get("evidenceFile") as File | null;

  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select a PDF evidence document." };
  }

  // 5 MB size limit
  if (file.size > 5242880) {
    return { error: "Evidence file must not exceed 5 MB." };
  }

  // PDF extension & MIME check
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return { error: "Evidence document must be a PDF." };
  }

  // Read binary buffer and inspect magic bytes (%PDF = 0x25 0x50 0x44 0x46)
  const fileBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(fileBuffer.slice(0, 4));
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46
  ) {
    return {
      error:
        "Invalid file content: evidence document is not a valid PDF (magic bytes mismatch).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to upload evidence." };
  }

  // Inspect existing evidence before upload to clean up old PDF on success
  const { data: prevEvidence } = await supabase
    .from("student_skill_evidence")
    .select("evidence_type, storage_path")
    .eq("student_skill_id", studentSkillId)
    .maybeSingle();

  const oldStoragePath =
    prevEvidence?.evidence_type === "PDF_DOCUMENT" && prevEvidence?.storage_path
      ? prevEvidence.storage_path
      : null;

  const storagePath = `${user.id}/${studentSkillId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.pdf`;

  // Server-only admin client writes to private skill-evidence bucket
  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("skill-evidence")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Storage upload failed: ${uploadError.message}` };
  }

  // Register evidence metadata via narrow procedure
  const { error: rpcError } = await supabase.rpc(
    "register_skill_evidence_pdf",
    {
      p_student_skill_id: studentSkillId,
      p_storage_path: storagePath,
      p_description: description.trim() || undefined,
    }
  );

  if (rpcError) {
    // Compensating delete of unreferenced object
    try {
      await adminClient.storage.from("skill-evidence").remove([storagePath]);
    } catch {
      // Handled
    }
    return { error: `Failed to register evidence: ${rpcError.message}` };
  }

  // On successful registration, clean up prior replaced PDF evidence
  if (oldStoragePath && oldStoragePath !== storagePath) {
    try {
      await adminClient.storage.from("skill-evidence").remove([oldStoragePath]);
    } catch {
      // Best-effort cleanup
    }
  }

  revalidatePath("/student/skills");
  return { success: "PDF evidence document uploaded successfully." };
}

/**
 * Staff: Verify a student's pending skill claim
 */
export async function submitVerifySkill(
  studentSkillId: string
): Promise<SkillActionState> {
  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_student_skill", {
    p_student_skill_id: studentSkillId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/skills/reviews");
  return { success: "Skill claim verified successfully." };
}

/**
 * Staff: Reject a student's pending skill claim
 */
export async function submitRejectSkill(
  studentSkillId: string,
  reason?: string
): Promise<SkillActionState> {
  if (!studentSkillId) {
    return { error: "Skill claim ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_student_skill", {
    p_student_skill_id: studentSkillId,
    p_reason: reason?.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/skills/reviews");
  return { success: "Skill claim rejected." };
}

/**
 * Generate 5-minute signed URL for PDF evidence by evidenceId.
 * Enforces RLS verification against student_skill_evidence before signing.
 */
export async function getSkillEvidenceDownloadUrl(
  evidenceId: string
): Promise<{ error?: string; url?: string }> {
  if (!evidenceId) {
    return { error: "Evidence ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Query evidence under caller's RLS.
  // student_skill_evidence RLS allows:
  // - student: own evidence
  // - staff: student in can_access_student() scope
  // - recruiter/anon: NO access (0 rows)
  const { data: evidence, error: evError } = await supabase
    .from("student_skill_evidence")
    .select("id, evidence_type, storage_path")
    .eq("id", evidenceId)
    .maybeSingle();

  if (evError || !evidence) {
    return { error: "Evidence document not found or access denied." };
  }

  if (evidence.evidence_type !== "PDF_DOCUMENT" || !evidence.storage_path) {
    return { error: "Selected evidence is not a PDF document." };
  }

  // Issue 5-minute signed URL via private bucket using verified storage_path
  const { data: signedData, error: signError } = await supabase.storage
    .from("skill-evidence")
    .createSignedUrl(evidence.storage_path, 300);

  if (signError || !signedData?.signedUrl) {
    return { error: "Failed to generate download link." };
  }

  return { url: signedData.signedUrl };
}

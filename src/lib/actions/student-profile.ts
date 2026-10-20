"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StudentProfileActionState {
  error?: string;
  success?: string;
  profileCompleteness?: number;
}

/**
 * Update Student Professional Profile
 * Strictly invokes the narrow SECURITY DEFINER update_own_student_profile procedure.
 */
export async function submitUpdateProfile(
  _prevState: StudentProfileActionState | null,
  formData: FormData
): Promise<StudentProfileActionState> {
  const bio = (formData.get("bio") as string) || null;
  const publicHeadline = (formData.get("publicHeadline") as string) || null;
  const publicTagline = (formData.get("publicTagline") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const linkedinUrl = (formData.get("linkedinUrl") as string) || null;
  const portfolioUrl = (formData.get("portfolioUrl") as string) || null;
  const otherLinksRaw = (formData.get("otherLinks") as string) || "[]";

  let otherLinks: unknown = [];
  try {
    otherLinks = JSON.parse(otherLinksRaw);
    if (!Array.isArray(otherLinks)) {
      otherLinks = [];
    }
  } catch {
    otherLinks = [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("update_own_student_profile", {
    p_bio: bio ?? undefined,
    p_public_headline: publicHeadline ?? undefined,
    p_public_tagline: publicTagline ?? undefined,
    p_phone: phone ?? undefined,
    p_linkedin_url: linkedinUrl ?? undefined,
    p_portfolio_url: portfolioUrl ?? undefined,
    p_other_links: otherLinks as unknown as import("@/types/database").Json,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as { success?: boolean; profile_completeness?: number };

  revalidatePath("/student/profile");
  revalidatePath("/student/dashboard");

  return {
    success: "Profile updated successfully.",
    profileCompleteness: result?.profile_completeness,
  };
}

/**
 * Upload Profile Photo
 * Validates image size and MIME type, writes to private bucket, and invokes update_own_profile_photo.
 */
export async function submitUploadPhoto(
  formData: FormData
): Promise<{ error?: string; success?: string; photoPath?: string }> {
  const file = formData.get("photo") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select an image file to upload." };
  }

  // File size validation (<= 2MB)
  if (file.size > 2097152) {
    return { error: "Profile photo must not exceed 2 MB in size." };
  }

  // MIME type validation
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.type)) {
    return {
      error: "Invalid file type. Allowed formats: JPEG, PNG, and WebP.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to upload photo." };
  }

  // Read binary buffer and inspect magic bytes
  const fileBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(fileBuffer.slice(0, 12));

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isPng =
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    return {
      error:
        "Invalid file content: file magic bytes do not match an allowed image format (JPEG, PNG, WebP).",
    };
  }

  // Lookup prior photo path for replacement cleanup
  const { data: priorProfile } = await supabase
    .from("student_profiles")
    .select("profile_photo_path")
    .eq("profile_id", user.id)
    .single();

  const priorPhotoPath = priorProfile?.profile_photo_path;

  const ext = isJpeg ? "jpg" : isPng ? "png" : "webp";
  const fileName = `${Date.now()}-photo.${ext}`;
  const storagePath = `${user.id}/${fileName}`;

  // Upload to private profile-photos bucket using server-only admin client
  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("profile-photos")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { error: `Failed to upload image: ${uploadError.message}` };
  }

  // Update student_profiles record via narrow procedure
  const { error: rpcError } = await supabase.rpc("update_own_profile_photo", {
    p_storage_path: storagePath,
  });

  if (rpcError) {
    // Immediate compensating delete of orphaned storage object using trusted admin client
    try {
      const adminClient = createAdminClient();
      await adminClient.storage.from("profile-photos").remove([storagePath]);
    } catch {
      // Compensating deletion error handled
    }
    return { error: rpcError.message };
  }

  // Successfully updated: clean up prior photo if path changed
  if (priorPhotoPath && priorPhotoPath !== storagePath) {
    try {
      const adminClient = createAdminClient();
      await adminClient.storage.from("profile-photos").remove([priorPhotoPath]);
    } catch {
      // Historical photo cleanup failure handled; active photo is already recorded in DB
    }
  }

  revalidatePath("/student/profile");
  revalidatePath("/student/dashboard");

  return {
    success: "Profile photo updated successfully.",
    photoPath: storagePath,
  };
}

/**
 * Upload or Replace Student Resume
 * Validates PDF format, magic bytes (%PDF), and 5MB size limit, writes to private resumes bucket,
 * and executes transactional register_student_resume procedure with compensating delete on failure.
 */
export async function submitUploadResume(
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const file = formData.get("resume") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select a PDF resume file to upload." };
  }

  // 5 MB size limit
  if (file.size > 5242880) {
    return { error: "Resume file must not exceed 5 MB." };
  }

  // PDF MIME and extension check
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return { error: "Resume must be a PDF document." };
  }

  // Read binary buffer and verify PDF magic bytes (%PDF = 0x25 0x50 0x44 0x46)
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
        "Invalid file content: resume is not a valid PDF document (magic bytes mismatch).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to upload resume." };
  }

  const fileName = `${Date.now()}-resume.pdf`;
  const storagePath = `${user.id}/${fileName}`;

  // Upload to private resumes bucket using server-only admin client
  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("resumes")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Storage upload failed: ${uploadError.message}` };
  }

  // Register document metadata transactionally
  const { error: rpcError } = await supabase.rpc("register_student_resume", {
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_file_size_bytes: file.size,
    p_mime_type: "application/pdf",
  });

  if (rpcError) {
    // Immediate compensating delete of orphaned storage object using trusted admin client
    try {
      const adminClient = createAdminClient();
      await adminClient.storage.from("resumes").remove([storagePath]);
    } catch {
      // Compensating deletion error handled
    }
    return { error: `Failed to register resume: ${rpcError.message}` };
  }

  revalidatePath("/student/resume");
  revalidatePath("/student/dashboard");

  return { success: "Resume uploaded successfully." };
}

/**
 * Generate Short-Lived Signed Download URL for Resume
 * Authorizes access via documents database RLS and can_access_student check before issuing 5-minute URL.
 */
export async function getResumeDownloadUrl(
  storagePath: string
): Promise<{ error?: string; url?: string }> {
  if (!storagePath) {
    return { error: "Storage path is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify that the requested document exists in documents table under caller's RLS scope
  const { data: docRecord, error: docErr } = await supabase
    .from("documents")
    .select("owner_id, storage_path")
    .eq("storage_path", storagePath)
    .single();

  if (docErr || !docRecord) {
    return { error: "Resume document not found or access denied." };
  }

  // Double-check ownership / staff scope
  if (user.id !== docRecord.owner_id) {
    const { data: canAccess, error: accessErr } = await supabase.rpc(
      "can_current_user_access_student",
      { p_student_id: docRecord.owner_id }
    );

    if (accessErr || !canAccess) {
      return { error: "Unauthorized to access this resume." };
    }
  }

  // Issue 5-minute (300 seconds) signed URL
  const { data: signedData, error: signError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(docRecord.storage_path, 300);

  if (signError || !signedData?.signedUrl) {
    return { error: "Failed to generate download link." };
  }

  return { url: signedData.signedUrl };
}

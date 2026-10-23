"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult<T = unknown> {
  success?: string;
  error?: string;
  data?: T;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  audience: "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF";
  expiresAt?: string | null;
}

export interface UpdateDraftAnnouncementPayload {
  id: string;
  title: string;
  body: string;
  audience: "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF";
  expiresAt?: string | null;
}

/**
 * Server action to create a new draft announcement.
 * Restricted to Super Admin and TNP Secretary.
 */
export async function createAnnouncementAction(
  payload: CreateAnnouncementPayload
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const cleanTitle = payload.title?.trim();
  const cleanBody = payload.body?.trim();

  if (!cleanTitle) {
    return { error: "Announcement title cannot be empty" };
  }
  if (cleanTitle.length > 200) {
    return { error: "Announcement title cannot exceed 200 characters" };
  }
  if (!cleanBody) {
    return { error: "Announcement body cannot be empty" };
  }
  if (cleanBody.length > 10000) {
    return { error: "Announcement body cannot exceed 10,000 characters" };
  }

  const { data, error } = await supabase.rpc("create_announcement", {
    p_title: cleanTitle,
    p_body: cleanBody,
    p_audience: payload.audience,
    p_expires_at: payload.expiresAt || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/announcements");
  revalidatePath("/staff/dashboard");

  return {
    success: "Announcement draft created successfully",
    data: { id: data as string },
  };
}

/**
 * Server action to update an existing draft announcement.
 * Restricted to Super Admin and TNP Secretary.
 */
export async function updateDraftAnnouncementAction(
  payload: UpdateDraftAnnouncementPayload
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const cleanTitle = payload.title?.trim();
  const cleanBody = payload.body?.trim();

  if (!cleanTitle) {
    return { error: "Announcement title cannot be empty" };
  }
  if (cleanTitle.length > 200) {
    return { error: "Announcement title cannot exceed 200 characters" };
  }
  if (!cleanBody) {
    return { error: "Announcement body cannot be empty" };
  }
  if (cleanBody.length > 10000) {
    return { error: "Announcement body cannot exceed 10,000 characters" };
  }

  const { error } = await supabase.rpc("update_draft_announcement", {
    p_announcement_id: payload.id,
    p_title: cleanTitle,
    p_body: cleanBody,
    p_audience: payload.audience,
    p_expires_at: payload.expiresAt || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/announcements");
  revalidatePath("/staff/dashboard");

  return { success: "Draft announcement updated successfully" };
}

/**
 * Server action to publish a draft announcement.
 * Restricted to Super Admin and TNP Secretary.
 */
export async function publishAnnouncementAction(
  announcementId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const { error } = await supabase.rpc("publish_announcement", {
    p_announcement_id: announcementId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/announcements");
  revalidatePath("/staff/dashboard");
  revalidatePath("/student/announcements");
  revalidatePath("/student/dashboard");
  revalidatePath("/recruiter/announcements");
  revalidatePath("/recruiter/dashboard");

  return { success: "Announcement published successfully" };
}

/**
 * Server action to archive an announcement.
 * Restricted to Super Admin and TNP Secretary.
 */
export async function archiveAnnouncementAction(
  announcementId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const { error } = await supabase.rpc("archive_announcement", {
    p_announcement_id: announcementId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/announcements");
  revalidatePath("/staff/dashboard");
  revalidatePath("/student/announcements");
  revalidatePath("/student/dashboard");
  revalidatePath("/recruiter/announcements");
  revalidatePath("/recruiter/dashboard");

  return { success: "Announcement archived successfully" };
}

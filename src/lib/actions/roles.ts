"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export interface RoleActionState {
  error?: string;
  success?: string;
}

/**
 * Super Admin Role Assignment Server Action
 * Strictly calls the SECURITY DEFINER assign_role() procedure.
 */
export async function submitAssignRole(
  _prevState: RoleActionState | null,
  formData: FormData
): Promise<RoleActionState> {
  const targetProfileId = formData.get("targetProfileId") as string;
  const newRole = formData.get(
    "newRole"
  ) as Database["public"]["Enums"]["user_role"];
  const coordinatorSlotRaw = formData.get("coordinatorSlot") as string;
  const coordinatorSlot = (coordinatorSlotRaw || null) as
    Database["public"]["Enums"]["coordinator_slot"] | null;

  if (!targetProfileId || !newRole) {
    return { error: "Target profile ID and new role are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("assign_role", {
    p_target_profile_id: targetProfileId,
    p_new_role: newRole,
    p_coordinator_slot: coordinatorSlot || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/roles");
  return { success: `Successfully updated profile to role ${newRole}.` };
}

/**
 * Super Admin Role Removal Server Action
 */
export async function submitRemoveStaffRole(
  _prevState: RoleActionState | null,
  formData: FormData
): Promise<RoleActionState> {
  const targetProfileId = formData.get("targetProfileId") as string;

  if (!targetProfileId) {
    return { error: "Target profile ID is required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("remove_staff_role", {
    p_target_profile_id: targetProfileId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/roles");
  return { success: "Staff role privileges successfully revoked." };
}

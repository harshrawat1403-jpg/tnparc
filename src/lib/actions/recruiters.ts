"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RecruiterActionResult {
  success?: string;
  error?: string;
  contactId?: string;
  invitationId?: string;
}

/**
 * Staff (Super Admin & Secretary): Create a recruiter contact
 */
export async function submitCreateRecruiterContact(
  prevState: RecruiterActionResult | null,
  formData: FormData
): Promise<RecruiterActionResult> {
  const companyId = formData.get("companyId") as string;
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const phone = (formData.get("phone") as string) || "";
  const designation = (formData.get("designation") as string) || "";

  if (!companyId) {
    return { error: "Company selection is required." };
  }

  if (!fullName || fullName.trim().length === 0) {
    return { error: "Contact full name is required." };
  }

  if (!email || email.trim().length === 0) {
    return { error: "Official contact email is required." };
  }

  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recruiter_contact", {
    p_company_id: companyId,
    p_full_name: cleanName,
    p_email: cleanEmail,
    p_phone: phone.trim() || undefined,
    p_designation: designation.trim() || undefined,
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("email")) {
      return {
        error:
          "A recruiter contact with this email address already exists in the system.",
      };
    }
    return { error: error.message };
  }

  const res = data as unknown as { success?: boolean; contact_id?: string };
  revalidatePath("/staff/recruiters");
  revalidatePath(`/staff/companies/${companyId}`);
  return {
    success: "Recruiter contact created successfully.",
    contactId: res?.contact_id,
  };
}

/**
 * Staff (Super Admin & Secretary): Update recruiter contact details
 */
export async function submitUpdateRecruiterContact(
  contactId: string,
  prevState: RecruiterActionResult | null,
  formData: FormData
): Promise<RecruiterActionResult> {
  const fullName = formData.get("fullName") as string;
  const phone = (formData.get("phone") as string) || "";
  const designation = (formData.get("designation") as string) || "";

  if (!fullName || fullName.trim().length === 0) {
    return { error: "Contact full name is required." };
  }

  const cleanName = fullName.trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_recruiter_contact", {
    p_contact_id: contactId,
    p_full_name: cleanName,
    p_phone: phone.trim() || undefined,
    p_designation: designation.trim() || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/recruiters");
  revalidatePath(`/staff/recruiters/${contactId}`);
  return { success: "Recruiter contact updated successfully." };
}

/**
 * Staff (Super Admin & Secretary): Deactivate recruiter contact
 */
export async function submitDeactivateRecruiterContact(
  contactId: string
): Promise<RecruiterActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_recruiter_contact", {
    p_contact_id: contactId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/recruiters");
  revalidatePath(`/staff/recruiters/${contactId}`);
  return { success: "Recruiter contact has been deactivated." };
}

/**
 * Staff (Super Admin & Secretary): Reactivate recruiter contact
 */
export async function submitReactivateRecruiterContact(
  contactId: string
): Promise<RecruiterActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_recruiter_contact", {
    p_contact_id: contactId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/recruiters");
  revalidatePath(`/staff/recruiters/${contactId}`);
  return { success: "Recruiter contact has been reactivated." };
}

/**
 * Staff (Super Admin & Secretary): Issue recruiter invitation with Supabase Auth integration and compensating cleanup
 */
export async function submitSendRecruiterInvitation(
  contactId: string,
  origin: string
): Promise<RecruiterActionResult> {
  const supabase = await createClient();

  // 1. Database-backed invitation intent creation
  const { data, error } = await supabase.rpc("create_recruiter_invitation", {
    p_contact_id: contactId,
  });

  if (error) {
    return { error: error.message };
  }

  const invData = data as unknown as {
    success?: boolean;
    invitation_id: string;
    contact_email: string;
    expires_at: string;
  };

  const invitationId = invData.invitation_id;
  const contactEmail = invData.contact_email;

  // 2. Server-only Supabase Admin API sends external invite
  const adminClient = createAdminClient();
  const redirectTarget = `${origin}/invite/accept`;

  try {
    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(
      contactEmail,
      {
        redirectTo: redirectTarget,
      }
    );

    if (authError) {
      // Check if email already exists in auth.users
      const isEmailExists =
        (authError as { code?: string }).code === "email_exists" ||
        authError.message.toLowerCase().includes("already been registered");

      if (isEmailExists) {
        // Query auth users list to find the existing account
        const { data: userList } = await adminClient.auth.admin.listUsers();
        const existingAuthUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === contactEmail.toLowerCase()
        );

        if (existingAuthUser) {
          // Check if this existing auth user already has a public profile
          const { data: existingProfile } = await adminClient
            .from("profiles")
            .select("role, is_active")
            .eq("id", existingAuthUser.id)
            .maybeSingle();

          if (
            existingProfile &&
            [
              "STUDENT",
              "TNP_COORDINATOR",
              "TNP_SECRETARY",
              "SUPER_ADMIN",
            ].includes(existingProfile.role)
          ) {
            // Unrelated institutional account cannot be invited or converted to RECRUITER
            await supabase.rpc("revoke_recruiter_invitation", {
              p_invitation_id: invitationId,
            });
            return {
              error: `Cannot invite ${contactEmail}: an institutional account (${existingProfile.role}) is already registered with this address.`,
            };
          }

          if (existingProfile?.role === "RECRUITER") {
            // Already a recruiter: check if bound to another contact
            const { data: boundRec } = await adminClient
              .from("recruiter_profiles")
              .select("recruiter_contact_id")
              .eq("profile_id", existingAuthUser.id)
              .maybeSingle();

            if (boundRec && boundRec.recruiter_contact_id !== contactId) {
              await supabase.rpc("revoke_recruiter_invitation", {
                p_invitation_id: invitationId,
              });
              return {
                error: `Cannot invite ${contactEmail}: this user is already bound to a different recruiter contact.`,
              };
            }
          }

          // Case B: Existing auth user with no profile (or legitimate unbound recruiter)
          // Mark invitation onboarding-ready via trusted server adminClient
          await adminClient.rpc("mark_invitation_delivery_confirmed", {
            p_invitation_id: invitationId,
          });

          // The database invitation is now confirmed PENDING. They can sign in at /login with existing password
          // and navigate to /invite/accept to complete onboarding.
          // Note: RECRUITER_INVITATION_SENT is NOT recorded because Auth API did not send an email.
          revalidatePath("/staff/recruiters");
          revalidatePath(`/staff/recruiters/${contactId}`);
          return {
            success: `Invitation registered. An authentication account already exists for ${contactEmail}. The user can sign in at /login with their existing credentials and visit /invite/accept to accept the invitation.`,
            invitationId,
          };
        }
      }

      // External Auth failure -> execute compensating rollback
      let compFailed = false;
      try {
        const { error: compError } = await supabase.rpc(
          "revoke_recruiter_invitation",
          {
            p_invitation_id: invitationId,
          }
        );
        if (compError) compFailed = true;
      } catch {
        compFailed = true;
      }

      if (compFailed) {
        return {
          error: `CRITICAL: Failed to dispatch invitation email via Auth service (${authError.message}), AND automatic rollback of the pending database record failed. Staff must manually revoke invitation ID ${invitationId}.`,
        };
      }

      return {
        error: `Failed to dispatch invitation email via Auth service: ${authError.message}. The pending invitation was rolled back.`,
      };
    }

    // Auth API succeeded: mark onboarding delivery confirmed via trusted server adminClient
    await adminClient.rpc("mark_invitation_delivery_confirmed", {
      p_invitation_id: invitationId,
    });

    // Record RECRUITER_INVITATION_SENT in audit log
    const {
      data: { user: staffUser },
    } = await supabase.auth.getUser();

    if (staffUser) {
      await adminClient.from("audit_logs").insert({
        actor_id: staffUser.id,
        action: "RECRUITER_INVITATION_SENT",
        entity_type: "recruiter_invitation",
        entity_id: invitationId,
        metadata: {
          contact_id: contactId,
          contact_email: contactEmail,
        },
      });
    }
  } catch (err: unknown) {
    // Compensating rollback on network or execution failure
    let compFailed = false;
    try {
      const { error: compError } = await supabase.rpc(
        "revoke_recruiter_invitation",
        {
          p_invitation_id: invitationId,
        }
      );
      if (compError) compFailed = true;
    } catch {
      compFailed = true;
    }

    const message = err instanceof Error ? err.message : "Network error";
    if (compFailed) {
      return {
        error: `CRITICAL: Failed to communicate with Auth service (${message}), AND automatic rollback of the pending database record failed. Staff must manually revoke invitation ID ${invitationId}.`,
      };
    }

    return {
      error: `Failed to communicate with Auth service: ${message}. The pending invitation was rolled back.`,
    };
  }

  revalidatePath("/staff/recruiters");
  revalidatePath(`/staff/recruiters/${contactId}`);
  return {
    success: `Invitation successfully sent to ${contactEmail}. Valid for 7 days.`,
    invitationId,
  };
}

/**
 * Staff (Super Admin & Secretary): Revoke a pending recruiter invitation
 */
export async function submitRevokeRecruiterInvitation(
  invitationId: string
): Promise<RecruiterActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_recruiter_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff/recruiters");
  return { success: "Recruiter invitation has been revoked." };
}

/**
 * Recruiter Acceptance: Called by authenticated invitee on /invite/accept
 */
export async function submitAcceptRecruiterInvitation(): Promise<{
  success?: boolean;
  error?: string;
  companyName?: string;
  contactName?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to accept recruiter invitation." };
  }

  const { data, error } = await supabase.rpc("accept_recruiter_invitation");

  if (error) {
    return { error: error.message };
  }

  const res = data as unknown as {
    success?: boolean;
    company_name?: string;
    full_name?: string;
  };

  revalidatePath("/recruiter/dashboard");
  return {
    success: true,
    companyName: res?.company_name,
    contactName: res?.full_name,
  };
}

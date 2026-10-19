"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionState {
  error?: string;
  success?: string;
  data?: Record<string, unknown>;
}

const GENERIC_SIGNUP_ERROR =
  "Unable to complete registration. If you are an eligible student, ensure you are using your official institutional email or contact the TNP office.";

/**
 * Normalizes email: lower(trim(email))
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Student Account Registration Server Action
 * Authoritative gate: active, unclaimed entry in student_roster.
 * Never enumerates or confirms whether an email is present in the roster.
 */
export async function submitSignup(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const emailRaw = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!emailRaw || !password || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters in length." };
  }

  const normalizedEmail = normalizeEmail(emailRaw);

  // Optional domain allowlist defense-in-depth (never replaces roster matching)
  const allowedDomainsEnv = process.env.ALLOWED_EMAIL_DOMAINS;
  if (allowedDomainsEnv) {
    const allowedDomains = allowedDomainsEnv
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    if (allowedDomains.length > 0) {
      const emailDomain = normalizedEmail.split("@")[1];
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return { error: GENERIC_SIGNUP_ERROR };
      }
    }
  }

  // Authoritative check: verify against active unclaimed student_roster via admin client
  try {
    const admin = createAdminClient();
    const { data: rosterEntry, error: rosterError } = await admin
      .from("student_roster")
      .select("id, is_active, claimed_by")
      .eq("institutional_email", normalizedEmail)
      .maybeSingle();

    if (
      rosterError ||
      !rosterEntry ||
      !rosterEntry.is_active ||
      rosterEntry.claimed_by !== null
    ) {
      // Intentionally generic error response to prevent roster enumeration
      return { error: GENERIC_SIGNUP_ERROR };
    }

    // Call Supabase Auth signup
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (signUpError) {
      return { error: GENERIC_SIGNUP_ERROR };
    }

    return {
      success:
        "Registration initiated. Please check your institutional email to confirm your account and complete activation.",
    };
  } catch {
    return { error: GENERIC_SIGNUP_ERROR };
  }
}

/**
 * User Sign In Server Action
 * Validates credentials and redirects strictly by verified profile role and lifecycle status.
 */
export async function submitLogin(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const emailRaw = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "";

  if (!emailRaw || !password) {
    return { error: "Email and password are required." };
  }

  const normalizedEmail = normalizeEmail(emailRaw);
  const supabase = await createClient();

  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (signInError || !authData.user) {
    return {
      error: "Invalid email or password. Please verify your credentials.",
    };
  }

  // Resolve user profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, student_lifecycle_status")
    .eq("id", authData.user.id)
    .maybeSingle();

  // If profile missing (e.g. newly confirmed student), attempt provisioning
  if (!profile) {
    const { data: provisionResult, error: provisionError } = await supabase.rpc(
      "provision_student_account"
    );

    if (!provisionError && provisionResult) {
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("role, is_active, student_lifecycle_status")
        .eq("id", authData.user.id)
        .maybeSingle();
      profile = freshProfile;
    }
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error:
        "No active profile found for this account. Please contact the TNP office.",
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return {
      error:
        "Your account is currently deactivated. Please contact the TNP office.",
    };
  }

  // Route safely by role & lifecycle
  let targetPath = "/";
  if (profile.role === "STUDENT") {
    targetPath =
      profile.student_lifecycle_status === "STUDENT_ACTIVE"
        ? "/student/dashboard"
        : "/unauthorized";
  } else if (
    profile.role === "TNP_COORDINATOR" ||
    profile.role === "TNP_SECRETARY"
  ) {
    targetPath = "/staff/dashboard";
  } else if (profile.role === "SUPER_ADMIN") {
    targetPath = redirectTo.startsWith("/admin") ? redirectTo : "/admin/roles";
  } else if (profile.role === "RECRUITER") {
    targetPath = "/recruiter/dashboard";
  }

  redirect(targetPath);
}

/**
 * Sign Out Server Action
 */
export async function submitSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Password Recovery Request Server Action
 */
export async function submitForgotPassword(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const emailRaw = formData.get("email") as string;
  if (!emailRaw) {
    return { error: "Email address is required." };
  }

  const normalizedEmail = normalizeEmail(emailRaw);
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  return {
    success:
      "If an active account exists for that email, a password reset link has been dispatched.",
  };
}

/**
 * Reset Password Server Action
 */
export async function submitResetPassword(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters in length." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/login?notice=password_updated");
}

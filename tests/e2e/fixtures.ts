import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TEST_CREDENTIALS = {
  student: {
    email: "phase15_student@vnit.test",
    password: "TestPassword123!",
    role: "STUDENT",
    expectedDashboard: "/student/dashboard",
  },
  staff: {
    email: "phase15_staff@vnit.test",
    password: "TestPassword123!",
    role: "TNP_SECRETARY",
    expectedDashboard: "/staff/dashboard",
  },
  admin: {
    email: "phase15_admin@vnit.test",
    password: "TestPassword123!",
    role: "SUPER_ADMIN",
    expectedDashboard: "/admin/roles",
  },
  recruiter: {
    email: "phase15_recruiter@vnit.test",
    password: "TestPassword123!",
    role: "RECRUITER",
    expectedDashboard: "/recruiter/dashboard",
  },
};

async function findUserByEmail(email: string) {
  let page = 1;
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 50 });
    if (!data?.users || data.users.length === 0) break;
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (found) return found;
    if (data.users.length < 50) break;
    page++;
  }
  return null;
}

/**
 * Ensures deterministic test users exist with known passwords and complete profiles.
 */
export async function ensureE2ETestUsers() {
  const { data: barchProg } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "BARCH")
    .single();

  const programId = barchProg?.id;

  async function ensureUser(
    email: string,
    password: string,
    role: string,
    displayName: string,
    lifecycleStatus: string | null = null
  ): Promise<string> {
    let user = await findUserByEmail(email);

    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) {
        user = await findUserByEmail(email);
        if (!user) throw error;
      } else {
        user = created.user;
      }
    }

    if (user) {
      await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
    }

    if (!user?.id) throw new Error(`Failed to create or find user ${email}`);

    // Deactivate competing roles if singleton
    if (role === "SUPER_ADMIN") {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("role", "SUPER_ADMIN");
    }
    if (role === "TNP_SECRETARY") {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("role", "TNP_SECRETARY");
    }

    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: user.id,
      role,
      display_name: displayName,
      is_active: true,
      student_lifecycle_status: lifecycleStatus,
    });
    if (upsertErr) throw upsertErr;

    return user.id;
  }

  // 1. Admin
  const adminId = await ensureUser(
    TEST_CREDENTIALS.admin.email,
    TEST_CREDENTIALS.admin.password,
    TEST_CREDENTIALS.admin.role,
    "Phase 15 Super Admin"
  );

  // 2. Staff (Secretary)
  await ensureUser(
    TEST_CREDENTIALS.staff.email,
    TEST_CREDENTIALS.staff.password,
    TEST_CREDENTIALS.staff.role,
    "Phase 15 Secretary"
  );

  // 3. Student
  const studentId = await ensureUser(
    TEST_CREDENTIALS.student.email,
    TEST_CREDENTIALS.student.password,
    TEST_CREDENTIALS.student.role,
    "Phase 15 Student",
    "STUDENT_ACTIVE"
  );

  if (programId) {
    await admin.from("student_roster").upsert(
      {
        program_id: programId,
        batch: "2026",
        institutional_id: "P15-E2E-001",
        full_name: "Phase 15 Student",
        institutional_email: TEST_CREDENTIALS.student.email,
        is_active: true,
        claimed_by: studentId,
      },
      { onConflict: "institutional_email" }
    );

    await admin.from("academic_records").upsert(
      {
        profile_id: studentId,
        program_id: programId,
        batch: "2026",
        cgpa: 8.8,
        active_backlogs: 0,
        verification_status: "VERIFIED",
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
  }

  await admin.from("student_profiles").upsert(
    {
      profile_id: studentId,
      public_profile_enabled: true,
      public_resume_enabled: true,
      profile_slug: "phase15-student",
      phone: "+91 98765 43210",
      bio: "Phase 15 test student bio.",
      public_headline: "Architecture Student",
      profile_completeness: 100,
    },
    { onConflict: "profile_id" }
  );

  // 4. Recruiter
  const recruiterId = await ensureUser(
    TEST_CREDENTIALS.recruiter.email,
    TEST_CREDENTIALS.recruiter.password,
    TEST_CREDENTIALS.recruiter.role,
    "Phase 15 Recruiter"
  );

  const { data: comp } = await admin
    .from("companies")
    .upsert(
      {
        name: "Phase 15 Architecture Studio",
        normalized_name: "phase 15 architecture studio",
        created_by: adminId,
      },
      { onConflict: "normalized_name" }
    )
    .select("id")
    .single();

  if (comp) {
    const { data: contact } = await admin
      .from("recruiter_contacts")
      .upsert(
        {
          company_id: comp.id,
          full_name: "Phase 15 Recruiter Contact",
          email: TEST_CREDENTIALS.recruiter.email,
          is_active: true,
          created_by: adminId,
        },
        { onConflict: "company_id,email" }
      )
      .select("id")
      .single();

    if (contact) {
      await admin.from("recruiter_profiles").upsert(
        {
          profile_id: recruiterId,
          company_id: comp.id,
          recruiter_contact_id: contact.id,
        },
        { onConflict: "profile_id" }
      );
    }
  }
}

/**
 * Signs in via the UI login form and waits for redirection to complete.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectedDashboard: string
) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15000,
  });

  expect(page.url()).not.toContain("/login");
  expect(page.url()).not.toContain("/unauthorized");
  expect(page.url()).toContain(expectedDashboard);
}

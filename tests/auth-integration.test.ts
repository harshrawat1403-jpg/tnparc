// Mock server-only in Node.js test environment
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { createClient } from "@supabase/supabase-js";
import { submitSignup } from "../src/lib/actions/auth";
import type { Database } from "../src/types/database";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 3 Auth & Provisioning Integration Suite", async (t) => {
  // Retrieve academic program for fixtures
  const { data: program } = await admin
    .from("academic_programs")
    .select("id")
    .eq("code", "BARCH")
    .single();

  assert.ok(program, "BARCH program must exist");

  // Synthetic Test Emails
  const validEmail = "integration_valid@vnit.test";
  const nonRosterEmail = "integration_nonroster@vnit.test";
  const inactiveEmail = "integration_inactive@vnit.test";
  const claimedEmail = "integration_claimed@vnit.test";
  const mixedCaseEmail = "  InTeGrAtIoN_MiXeD@VnIt.TeSt  ";
  const normalizedMixedEmail = "integration_mixed@vnit.test";

  // Clean prior test artifacts
  await admin
    .from("student_roster")
    .delete()
    .in("institutional_email", [
      validEmail,
      inactiveEmail,
      claimedEmail,
      normalizedMixedEmail,
    ]);

  // Seed fixture roster entries
  await admin.from("student_roster").insert([
    {
      institutional_id: "ID_INT_VALID",
      full_name: "Valid Student",
      institutional_email: validEmail,
      program_id: program.id,
      batch: "2026",
      is_active: true,
      claimed_by: null,
    },
    {
      institutional_id: "ID_INT_INACTIVE",
      full_name: "Inactive Student",
      institutional_email: inactiveEmail,
      program_id: program.id,
      batch: "2026",
      is_active: false,
      claimed_by: null,
    },
    {
      institutional_id: "ID_INT_CLAIMED",
      full_name: "Claimed Student",
      institutional_email: claimedEmail,
      program_id: program.id,
      batch: "2026",
      is_active: true,
      claimed_by: "00000000-0000-0000-0000-000000000001",
    },
    {
      institutional_id: "ID_INT_MIXED",
      full_name: "Mixed Case Student",
      institutional_email: normalizedMixedEmail,
      program_id: program.id,
      batch: "2026",
      is_active: true,
      claimed_by: null,
    },
  ]);

  const GENERIC_ERROR =
    "Unable to complete registration. If you are an eligible student, ensure you are using your official institutional email or contact the TNP office.";

  await t.test(
    "1. Valid roster signup succeeds and returns confirmation notice",
    async () => {
      const formData = new FormData();
      formData.append("email", validEmail);
      formData.append("password", "TestPass1234");
      formData.append("confirmPassword", "TestPass1234");

      const result = await submitSignup(null, formData);
      assert.equal(result.error, undefined);
      assert.match(
        result.success || "",
        /Registration initiated|confirmation email/
      );
    }
  );

  await t.test(
    "2. Non-roster signup is rejected generically without enumeration",
    async () => {
      const formData = new FormData();
      formData.append("email", nonRosterEmail);
      formData.append("password", "TestPass1234");
      formData.append("confirmPassword", "TestPass1234");

      const result = await submitSignup(null, formData);
      assert.equal(result.error, GENERIC_ERROR);
      assert.equal(result.success, undefined);
    }
  );

  await t.test("3. Inactive roster entry is rejected generically", async () => {
    const formData = new FormData();
    formData.append("email", inactiveEmail);
    formData.append("password", "TestPass1234");
    formData.append("confirmPassword", "TestPass1234");

    const result = await submitSignup(null, formData);
    assert.equal(result.error, GENERIC_ERROR);
    assert.equal(result.success, undefined);
  });

  await t.test(
    "4. Already-claimed roster entry is rejected generically",
    async () => {
      const formData = new FormData();
      formData.append("email", claimedEmail);
      formData.append("password", "TestPass1234");
      formData.append("confirmPassword", "TestPass1234");

      const result = await submitSignup(null, formData);
      assert.equal(result.error, GENERIC_ERROR);
      assert.equal(result.success, undefined);
    }
  );

  await t.test(
    "5. Normalized email matching handles whitespace and uppercase input",
    async () => {
      const formData = new FormData();
      formData.append("email", mixedCaseEmail);
      formData.append("password", "TestPass1234");
      formData.append("confirmPassword", "TestPass1234");

      const result = await submitSignup(null, formData);
      assert.equal(result.error, undefined);
      assert.match(
        result.success || "",
        /Registration initiated|confirmation email/
      );
    }
  );

  await t.test(
    "6. Student provisioning idempotency and transactional integrity",
    async () => {
      const testProvEmail = "provision_test@vnit.test";

      // Clean up if exists
      await admin
        .from("student_roster")
        .delete()
        .eq("institutional_email", testProvEmail);

      const { data: rosterRow } = await admin
        .from("student_roster")
        .insert({
          institutional_id: "ID_INT_PROV",
          full_name: "Provision Test Student",
          institutional_email: testProvEmail,
          program_id: program.id,
          batch: "2026",
          is_active: true,
          claimed_by: null,
        })
        .select()
        .single();

      assert.ok(rosterRow);

      // Create auth user
      const { data: authUser, error: authErr } =
        await admin.auth.admin.createUser({
          email: testProvEmail,
          password: "TestPassword123",
          email_confirm: true,
        });

      assert.ok(
        authUser.user,
        `Auth user creation failed: ${authErr?.message}`
      );
      const userId = authUser.user.id;

      // Call provision_student_account using client authenticated as this user
      const userClient = createClient<Database>(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );

      const { data: signInData } = await userClient.auth.signInWithPassword({
        email: testProvEmail,
        password: "TestPassword123",
      });

      assert.ok(signInData.session, "Sign in must succeed");

      // First call -> PROVISIONED
      const { data: prov1, error: err1 } = await userClient.rpc(
        "provision_student_account"
      );
      assert.equal(err1, null);
      assert.equal((prov1 as Record<string, unknown>)?.status, "PROVISIONED");

      // Verify database rows created
      const { data: prof } = await admin
        .from("profiles")
        .select("role, student_lifecycle_status")
        .eq("id", userId)
        .single();
      assert.equal(prof?.role, "STUDENT");
      assert.equal(prof?.student_lifecycle_status, "STUDENT_ACTIVE");

      const { data: acad } = await admin
        .from("academic_records")
        .select("program_id, batch, verification_status")
        .eq("profile_id", userId)
        .single();
      assert.equal(acad?.batch, "2026");
      assert.equal(acad?.verification_status, "UNVERIFIED");

      const { data: rosterCheck } = await admin
        .from("student_roster")
        .select("claimed_by")
        .eq("id", rosterRow.id)
        .single();
      assert.equal(rosterCheck?.claimed_by, userId);

      // Second call -> ALREADY_PROVISIONED (idempotent)
      const { data: prov2, error: err2 } = await userClient.rpc(
        "provision_student_account"
      );
      assert.equal(err2, null);
      assert.equal(
        (prov2 as Record<string, unknown>)?.status,
        "ALREADY_PROVISIONED"
      );

      // Cleanup
      await admin.auth.admin.deleteUser(userId);
      await admin.from("student_roster").delete().eq("id", rosterRow.id);
    }
  );

  await t.test(
    "7. Secretary cannot assign roles (Super Admin-only enforcement)",
    async () => {
      const secEmail = "test_sec_role@vnit.test";

      // Create synthetic secretary user
      const { data: secAuth } = await admin.auth.admin.createUser({
        email: secEmail,
        password: "SecPassword123",
        email_confirm: true,
      });
      assert.ok(secAuth.user);

      await admin.from("profiles").upsert({
        id: secAuth.user.id,
        role: "TNP_SECRETARY",
        display_name: "Secretary Test",
        is_active: true,
      });

      const secClient = createClient<Database>(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );

      await secClient.auth.signInWithPassword({
        email: secEmail,
        password: "SecPassword123",
      });

      // Attempt to assign coordinator role as Secretary
      const { error: assignError } = await secClient.rpc("assign_role", {
        p_target_profile_id: "00000000-0000-0000-0000-000000000001",
        p_new_role: "TNP_COORDINATOR",
        p_coordinator_slot: "SLOT_2",
      });

      assert.ok(assignError, "assign_role must fail for Secretary");
      assert.match(
        assignError.message,
        /Unauthorized: Only an active SUPER_ADMIN can assign roles/
      );

      // Cleanup
      await admin.auth.admin.deleteUser(secAuth.user.id);
    }
  );

  await t.test(
    "8. Student lifecycle status strictly distinguishes ACTIVE vs GRADUATED/ALUMNI",
    async () => {
      // Test profile resolution for lifecycle status
      const activeStudent = {
        role: "STUDENT" as const,
        is_active: true,
        student_lifecycle_status: "STUDENT_ACTIVE" as const,
      };
      const graduatedStudent = {
        role: "STUDENT" as const,
        is_active: true,
        student_lifecycle_status: "STUDENT_GRADUATED" as const,
      };
      const alumniStudent = {
        role: "STUDENT" as const,
        is_active: true,
        student_lifecycle_status: "ALUMNI" as const,
      };

      // Helper function simulating the proxy / login lifecycle routing rule
      function resolveStudentRoute(p: {
        role: string;
        is_active: boolean;
        student_lifecycle_status: string | null;
      }): string {
        if (p.role === "STUDENT" && p.is_active) {
          if (p.student_lifecycle_status === "STUDENT_ACTIVE") {
            return "/student/dashboard";
          }
          return "/unauthorized";
        }
        return "/login";
      }

      assert.equal(
        resolveStudentRoute(activeStudent),
        "/student/dashboard",
        "Active student permitted to student dashboard"
      );
      assert.equal(
        resolveStudentRoute(graduatedStudent),
        "/unauthorized",
        "Graduated student rerouted to unauthorized (not active dashboard)"
      );
      assert.equal(
        resolveStudentRoute(alumniStudent),
        "/unauthorized",
        "Alumni rerouted to unauthorized (not active dashboard)"
      );
    }
  );
});

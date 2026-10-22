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
import type { Database } from "../src/types/database";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient<Database>(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test("Phase 10 — Alumni & Industry Relations Integration Suite", async (t) => {
  // Programs lookup
  const { data: barchProg } = await admin
    .from("academic_programs")
    .select("id, code, display_name")
    .eq("code", "BARCH")
    .single();

  const { data: mplanProg } = await admin
    .from("academic_programs")
    .select("id, code, display_name")
    .eq("code", "MPLAN")
    .single();

  assert.ok(barchProg, "BARCH academic program must exist");
  assert.ok(mplanProg, "MPLAN academic program must exist");

  // Helper to safely provision auth user and active profile
  async function setupUser(
    email: string,
    role:
      | "SUPER_ADMIN"
      | "TNP_SECRETARY"
      | "TNP_COORDINATOR"
      | "STUDENT"
      | "RECRUITER",
    slot?: "SLOT_1" | "SLOT_2",
    lifecycle?: "STUDENT_ACTIVE" | "STUDENT_GRADUATED" | "ALUMNI"
  ): Promise<string> {
    const { data: list } = await admin.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email === email);
    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
      });
      assert.ifError(error);
      user = created.user;
    } else {
      await admin.auth.admin.updateUserById(user.id, {
        password: "TestPassword123!",
        email_confirm: true,
      });
    }

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
    if (role === "TNP_COORDINATOR" && slot) {
      await admin
        .from("profiles")
        .update({ is_active: false })
        .eq("coordinator_slot", slot);
    }

    await admin.from("profiles").upsert({
      id: user.id,
      role,
      display_name: email.split("@")[0] || "User",
      is_active: true,
      coordinator_slot: slot || null,
      student_lifecycle_status:
        role === "STUDENT" ? lifecycle || "STUDENT_ACTIVE" : null,
    });

    return user.id;
  }

  // Setup Users
  const adminId = await setupUser("phase10_admin@vnit.test", "SUPER_ADMIN");
  const secId = await setupUser("phase10_sec@vnit.test", "TNP_SECRETARY");
  const coordId = await setupUser(
    "phase10_coord@vnit.test",
    "TNP_COORDINATOR",
    "SLOT_1"
  );
  const sGrad1Id = await setupUser(
    "phase10_grad1@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const sGrad2Id = await setupUser(
    "phase10_grad2@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const sRangeId = await setupUser(
    "phase10_range@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_GRADUATED"
  );
  const sActiveId = await setupUser(
    "phase10_active@vnit.test",
    "STUDENT",
    undefined,
    "STUDENT_ACTIVE"
  );
  const sAlumExisting = await setupUser(
    "phase10_alum@vnit.test",
    "STUDENT",
    undefined,
    "ALUMNI"
  );
  const recruiterId = await setupUser(
    "phase10_recruiter@vnit.test",
    "RECRUITER"
  );

  const companyId = "60000000-0000-0000-0000-000000000001";
  const archCompanyId = "60000000-0000-0000-0000-000000000099";

  // Clean existing alumni profiles and employment history for test isolation
  await admin
    .from("alumni_profiles")
    .delete()
    .in("profile_id", [sGrad1Id, sGrad2Id, sRangeId, sActiveId, sAlumExisting]);

  // Seed academic records
  await admin.from("academic_records").upsert([
    {
      profile_id: sGrad1Id,
      program_id: barchProg.id,
      batch: "2026",
      cgpa: 8.75,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    {
      profile_id: sGrad2Id,
      program_id: mplanProg.id,
      batch: "2026",
      cgpa: 8.2,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    {
      profile_id: sRangeId,
      program_id: barchProg.id,
      batch: "2022-2027",
      cgpa: 8.85,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    {
      profile_id: sActiveId,
      program_id: barchProg.id,
      batch: "2026",
      cgpa: 9.1,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
    {
      profile_id: sAlumExisting,
      program_id: barchProg.id,
      batch: "2024",
      cgpa: 8.95,
      active_backlogs: 0,
      verification_status: "VERIFIED",
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    },
  ]);

  // Setup Coordinator Scope: BARCH 2026
  await admin.from("coordinator_student_scopes").upsert(
    {
      coordinator_id: coordId,
      program_id: barchProg.id,
      batch: "2026",
      granted_by: adminId,
    },
    { onConflict: "coordinator_id,program_id,batch" }
  );

  // Canonical Active Company
  await admin.from("companies").upsert([
    {
      id: companyId,
      name: "Foster and Partners",
      normalized_name: "FOSTER AND PARTNERS",
      website: "https://fosterandpartners.example.com",
      description: "Global studio for sustainable architecture",
      is_archived: false,
      created_by: adminId,
    },
  ]);

  // Fixture Archived Company
  await admin.from("companies").upsert([
    {
      id: archCompanyId,
      name: "Defunct Architecture Lab",
      normalized_name: "DEFUNCT ARCHITECTURE LAB",
      website: "https://defunct.example.com",
      description: "Archived firm",
      is_archived: true,
      created_by: adminId,
    },
  ]);

  // Ensure sAlumExisting has an alumni_profiles row
  await admin.from("alumni_profiles").insert([
    {
      profile_id: sAlumExisting,
      graduation_year: 2024,
      program_id: barchProg.id,
      current_organization: "Zaha Hadid Architects",
      company_id: null,
      current_role: "Lead Associate",
      professional_domain: "Computational Design",
      city: "London",
      country: "United Kingdom",
      linkedin_url: "https://linkedin.com/in/vikram-alumni",
      willing_to_mentor: true,
      willing_to_refer: true,
      willing_to_support_placement: true,
      public_alumni_enabled: true,
      consent_recorded_at: new Date().toISOString(),
    },
  ]);

  // Helper client sign-in
  const createClientForUser = async (email: string) => {
    const client = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } =
      await client.auth.signInWithPassword({
        email,
        password: "TestPassword123!",
      });
    assert.ifError(authErr);
    assert.ok(authData.session?.access_token);
    return client;
  };

  const cAdmin = await createClientForUser("phase10_admin@vnit.test");
  const cCoord = await createClientForUser("phase10_coord@vnit.test");
  const cGrad1 = await createClientForUser("phase10_grad1@vnit.test");
  const cActive = await createClientForUser("phase10_active@vnit.test");
  const cRecruiter = await createClientForUser("phase10_recruiter@vnit.test");

  // ==========================================================================
  // Test 1: Lifecycle Progression & Graduation Authority
  // ==========================================================================
  await t.test("Graduation Authority & Scope Enforcement", async () => {
    // 1. Student cannot mark self graduated
    const { error: errSelfGrad } = await cGrad1.rpc("mark_student_graduated", {
      p_student_id: sGrad1Id,
      p_reason: "Graduating myself",
    });
    assert.ok(errSelfGrad, "Student must not be able to graduate self");
    assert.equal(errSelfGrad.code, "42501");

    // 2. Coordinator cannot mark student outside scope graduated (sGrad2Id is MPLAN 2026)
    const { error: errUnscopedGrad } = await cCoord.rpc(
      "mark_student_graduated",
      {
        p_student_id: sGrad2Id,
        p_reason: "Out of scope graduation",
      }
    );
    assert.ok(
      errUnscopedGrad,
      "Coordinator must not graduate unscoped student"
    );
    assert.equal(errUnscopedGrad.code, "42501");

    // 3. Coordinator CAN mark student inside scope graduated (sGrad1Id is BARCH 2026)
    const { error: errScopedGrad } = await cCoord.rpc(
      "mark_student_graduated",
      {
        p_student_id: sGrad1Id,
        p_reason: "Senate meeting 45 approval for batch 2026",
      }
    );
    assert.ok(
      !errScopedGrad,
      `Scoped graduation failed: ${errScopedGrad?.message}`
    );

    // Verify status changed to STUDENT_GRADUATED and is_active remains true
    const { data: pGrad1 } = await admin
      .from("profiles")
      .select("student_lifecycle_status, is_active")
      .eq("id", sGrad1Id)
      .single();

    assert.equal(pGrad1?.student_lifecycle_status, "STUDENT_GRADUATED");
    assert.equal(
      pGrad1?.is_active,
      true,
      "Graduation must preserve is_active = true"
    );

    // 4. Cannot re-graduate already graduated student
    const { error: errReGrad } = await cCoord.rpc("mark_student_graduated", {
      p_student_id: sGrad1Id,
      p_reason: "Duplicate graduation attempt",
    });
    assert.ok(errReGrad, "Cannot re-graduate already graduated student");
    assert.equal(errReGrad.code, "P0001");

    // 5. Empty reason rejected
    const { error: errEmptyReason } = await cCoord.rpc(
      "mark_student_graduated",
      {
        p_student_id: sActiveId,
        p_reason: "   ",
      }
    );
    assert.ok(errEmptyReason, "Empty reason must be rejected");
    assert.equal(errEmptyReason.code, "22023");
  });

  // ==========================================================================
  // Test 2: Alumni Conversion, Cohort Derivation & Batch Parsing
  // ==========================================================================
  await t.test(
    "Alumni Transition, Cohort Derivation & Matched Employer Rules",
    async () => {
      // 1. Cannot transition STUDENT_ACTIVE directly to ALUMNI (skipping graduation)
      const { error: errDirectActive } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sActiveId,
          p_current_organization: "Direct Studio",
        }
      );
      assert.ok(
        errDirectActive,
        "Direct active to alumni transition must fail"
      );
      assert.equal(errDirectActive.code, "P0001");

      // 2. Cannot provide BOTH company_id and current_organization simultaneously
      const { error: errBothOrg } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sGrad1Id,
          p_current_organization: "Free Text Practice",
          p_company_id: companyId,
        }
      );
      assert.ok(
        errBothOrg,
        "Cannot specify both company_id and current_organization"
      );
      assert.equal(errBothOrg.code, "22023");

      // 3. Conversion with archived company rejected
      const { error: errArchConvert } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sGrad1Id,
          p_company_id: archCompanyId,
        }
      );
      assert.ok(errArchConvert, "Conversion with archived company must fail");
      assert.equal(errArchConvert.code, "P0002");

      // 4. Successful conversion with unmatched organization (single 4-digit batch 2026)
      const { error: errConvertOk } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sGrad1Id,
          p_current_organization: "Morphogenesis",
          p_current_role: "Architectural Associate",
          p_professional_domain: "Sustainable Architecture",
          p_city: "New Delhi",
          p_country: "India",
          p_linkedin_url: "https://linkedin.com/in/prakash-arch",
          p_reason: "Transition to alumni upon degree completion",
        }
      );
      assert.ok(
        !errConvertOk,
        `Alumni conversion failed: ${errConvertOk?.message}`
      );

      // Verify profiles.student_lifecycle_status is ALUMNI
      const { data: pAlum1 } = await admin
        .from("profiles")
        .select("student_lifecycle_status, is_active")
        .eq("id", sGrad1Id)
        .single();
      assert.equal(pAlum1?.student_lifecycle_status, "ALUMNI");
      assert.equal(
        pAlum1?.is_active,
        true,
        "Permanent student is_active must be true"
      );

      // Verify alumni_profiles row
      const { data: apRow } = await admin
        .from("alumni_profiles")
        .select("*")
        .eq("profile_id", sGrad1Id)
        .single();

      assert.ok(apRow, "alumni_profiles row must exist");
      assert.equal(
        apRow.graduation_year,
        2026,
        "Cohort graduation_year authoritatively derived"
      );
      assert.equal(apRow.current_organization, "Morphogenesis");
      assert.equal(apRow.company_id, null);
      assert.equal(apRow.current_role, "Architectural Associate");
      assert.equal(
        apRow.public_alumni_enabled,
        false,
        "Public directory disabled by default"
      );
      assert.equal(
        apRow.consent_recorded_at,
        null,
        "Consent timestamp null until opted in"
      );

      // 5. Conversion with year-range batch cohort (2022-2027 -> graduation_year = 2027)
      const { error: errRangeConvert } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sRangeId,
          p_current_organization: "HCP Design",
          p_current_role: "Urban Planner",
          p_reason: "Graduation of 5-year B.Arch batch 2022-2027",
        }
      );
      assert.ok(
        !errRangeConvert,
        `Range batch convert: ${errRangeConvert?.message}`
      );

      const { data: apRangeRow } = await admin
        .from("alumni_profiles")
        .select("graduation_year")
        .eq("profile_id", sRangeId)
        .single();
      assert.equal(
        apRangeRow?.graduation_year,
        2027,
        "Graduation year derived as end year 2027 from batch range 2022-2027"
      );

      // 6. Malformed and inverted batch rejections
      await admin
        .from("academic_records")
        .update({ batch: "Spring 2027" })
        .eq("profile_id", sActiveId);
      await admin
        .from("profiles")
        .update({ student_lifecycle_status: "STUDENT_GRADUATED" })
        .eq("id", sActiveId);

      const { error: errMalformedBatch } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sActiveId,
          p_current_organization: "Studio X",
        }
      );
      assert.ok(errMalformedBatch, "Malformed batch must be rejected");
      assert.equal(errMalformedBatch.code, "22023");

      await admin
        .from("academic_records")
        .update({ batch: "2027-2022" })
        .eq("profile_id", sActiveId);

      const { error: errInvertedBatch } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sActiveId,
          p_current_organization: "Studio X",
        }
      );
      assert.ok(errInvertedBatch, "Inverted batch must be rejected");
      assert.equal(errInvertedBatch.code, "22023");

      // Reset sActiveId back to STUDENT_ACTIVE and 2026
      await admin
        .from("academic_records")
        .update({ batch: "2026" })
        .eq("profile_id", sActiveId);
      await admin
        .from("profiles")
        .update({ student_lifecycle_status: "STUDENT_ACTIVE" })
        .eq("id", sActiveId);

      // 7. Duplicate conversion rejected
      const { error: errDupConvert } = await cAdmin.rpc(
        "convert_student_to_alumni",
        {
          p_student_id: sGrad1Id,
          p_current_organization: "Studio Second",
        }
      );
      assert.ok(errDupConvert, "Duplicate conversion must fail");
      assert.equal(errDupConvert.code, "P0001");
    }
  );

  // ==========================================================================
  // Test 3: Alumni Self-Service & DB-Managed Consent Timestamping
  // ==========================================================================
  await t.test(
    "Alumni Self-Service & DB-Managed Consent Timestamping",
    async () => {
      // 1. Active student cannot call update_own_alumni_profile
      const { error: errActiveUpdate } = await cActive.rpc(
        "update_own_alumni_profile",
        {
          p_current_organization: "Not An Alumni",
        }
      );
      assert.ok(
        errActiveUpdate,
        "Active student cannot invoke update_own_alumni_profile"
      );
      assert.equal(errActiveUpdate.code, "42501");

      // 2. Alumnus updates own profile and enables public directory
      const { error: errAlumUpdate } = await cGrad1.rpc(
        "update_own_alumni_profile",
        {
          p_current_organization: "Morphogenesis",
          p_current_role: "Senior Associate",
          p_professional_domain: "Master Planning",
          p_city: "Bengaluru",
          p_country: "India",
          p_linkedin_url: "https://linkedin.com/in/prakash-senior",
          p_higher_studies_institution: "Harvard GSD",
          p_higher_studies_program: "Master in Urban Planning",
          p_higher_studies_year_start: 2026,
          p_willing_to_mentor: true,
          p_willing_to_refer: true,
          p_willing_to_support_placement: false,
          p_public_alumni_enabled: true,
        }
      );
      assert.ok(
        !errAlumUpdate,
        `Alumni self-update: ${errAlumUpdate?.message}`
      );

      const { data: apUpdated } = await admin
        .from("alumni_profiles")
        .select("*")
        .eq("profile_id", sGrad1Id)
        .single();

      assert.equal(apUpdated?.public_alumni_enabled, true);
      assert.ok(
        apUpdated?.consent_recorded_at,
        "Server DB must timestamp consent_recorded_at"
      );
      assert.equal(apUpdated?.willing_to_mentor, true);
      assert.equal(apUpdated?.willing_to_refer, true);
      assert.equal(apUpdated?.higher_studies_institution, "Harvard GSD");

      // 3. Updating to archived company is rejected
      const { error: errArchUpdate } = await cGrad1.rpc(
        "update_own_alumni_profile",
        {
          p_company_id: archCompanyId,
        }
      );
      assert.ok(
        errArchUpdate,
        "Cannot update profile to link to archived company"
      );
      assert.equal(errArchUpdate.code, "P0002");

      // 4. Disabling public directory resets consent_recorded_at to NULL
      const { error: errDisablePub } = await cGrad1.rpc(
        "update_own_alumni_profile",
        {
          p_current_organization: "Morphogenesis",
          p_public_alumni_enabled: false,
        }
      );
      assert.ok(!errDisablePub);

      const { data: apDisabled } = await admin
        .from("alumni_profiles")
        .select("public_alumni_enabled, consent_recorded_at")
        .eq("profile_id", sGrad1Id)
        .single();

      assert.equal(apDisabled?.public_alumni_enabled, false);
      assert.equal(
        apDisabled?.consent_recorded_at,
        null,
        "Consent timestamp cleared when disabled"
      );

      // Re-enable for directory testing
      await cGrad1.rpc("update_own_alumni_profile", {
        p_current_organization: "Morphogenesis",
        p_public_alumni_enabled: true,
      });
    }
  );

  // ==========================================================================
  // Test 4: Additive Employment History, Zero Deletion & Permanent Retention
  // ==========================================================================
  await t.test(
    "Employment History Additive Retention & Deletion Denial Across All Actors",
    async () => {
      // 1. Add valid employment entry
      const { data: empRes1, error: errAddEmp1 } = await cGrad1.rpc(
        "add_own_alumni_employment",
        {
          p_organization: "Sanjay Puri Architects",
          p_role: "Junior Architect",
          p_started_at: "2024-06-01",
          p_ended_at: "2025-05-31",
          p_city: "Mumbai",
          p_country: "India",
          p_notes: "Worked on residential towers",
        }
      );
      assert.ok(!errAddEmp1, `Add employment failed: ${errAddEmp1?.message}`);
      const addedId1 = (empRes1 as { employment_id: string })?.employment_id;
      assert.ok(addedId1, "Returned employment id 1");

      // 2. Add second employment entry (confirming additive timeline)
      const { data: empRes2, error: errAddEmp2 } = await cGrad1.rpc(
        "add_own_alumni_employment",
        {
          p_organization: "Foster and Partners",
          p_company_id: companyId,
          p_role: "Senior Associate",
          p_started_at: "2025-06-01",
          p_ended_at: undefined,
          p_city: "London",
          p_country: "United Kingdom",
          p_notes: "International sustainable urbanism master plans",
        }
      );
      assert.ok(
        !errAddEmp2,
        `Add second employment failed: ${errAddEmp2?.message}`
      );
      const addedId2 = (empRes2 as { employment_id: string })?.employment_id;
      assert.ok(addedId2, "Returned employment id 2");

      // 3. Reject invalid dates (ended_at < started_at)
      const { error: errInvDate } = await cGrad1.rpc(
        "add_own_alumni_employment",
        {
          p_organization: "Studio Test",
          p_role: "Intern",
          p_started_at: "2025-01-01",
          p_ended_at: "2024-01-01",
        }
      );
      assert.ok(errInvDate, "Invalid dates must be rejected");
      assert.equal(errInvDate.code, "22023");

      // 4. Reject adding employment linked to archived company
      const { error: errArchEmp } = await cGrad1.rpc(
        "add_own_alumni_employment",
        {
          p_organization: "Defunct Firm",
          p_company_id: archCompanyId,
          p_role: "Draftsman",
          p_started_at: "2023-01-01",
          p_ended_at: "2023-12-31",
        }
      );
      assert.ok(errArchEmp, "Cannot add employment with archived company");
      assert.equal(errArchEmp.code, "P0002");

      // 5. Calling delete_own_alumni_employment fails because function is dropped
      const { error: errDeletedRpc } = await cGrad1.rpc(
        "delete_own_alumni_employment" as unknown as "get_public_alumni_directory",
        {
          p_employment_id: addedId1,
        } as unknown as Record<string, never>
      );
      assert.ok(
        errDeletedRpc,
        "delete_own_alumni_employment RPC must not exist"
      );
      assert.ok(
        errDeletedRpc.code === "PGRST202" || errDeletedRpc.code === "42883",
        `RPC must fail with PGRST202 or 42883, got: ${errDeletedRpc.code}`
      );

      // 6. Direct base table DELETE denied across all roles:
      // 6a. Alumni direct DELETE denied
      const { error: errDirectAlumDelete } = await cGrad1
        .from("alumni_employment_history")
        .delete()
        .eq("id", addedId1);
      assert.ok(
        errDirectAlumDelete,
        "Direct DELETE by alumni must be rejected"
      );
      assert.equal(errDirectAlumDelete.code, "42501");

      // 6b. Coordinator direct DELETE denied
      const { error: errDirectCoordDelete } = await cCoord
        .from("alumni_employment_history")
        .delete()
        .eq("id", addedId1);
      assert.ok(
        errDirectCoordDelete,
        "Direct DELETE by coordinator must be rejected"
      );
      assert.equal(errDirectCoordDelete.code, "42501");

      // 6c. Recruiter direct DELETE denied
      const { error: errDirectRecruiterDelete } = await cRecruiter
        .from("alumni_employment_history")
        .delete()
        .eq("id", addedId1);
      assert.ok(
        errDirectRecruiterDelete,
        "Direct DELETE by recruiter must be rejected"
      );
      assert.equal(errDirectRecruiterDelete.code, "42501");

      // 6d. Anonymous direct DELETE denied
      const { error: errDirectAnonDelete } = await anon
        .from("alumni_employment_history")
        .delete()
        .eq("id", addedId1);
      assert.ok(errDirectAnonDelete, "Direct DELETE by anon must be rejected");
      assert.equal(errDirectAnonDelete.code, "42501");

      // 7. Assert both employment records remain preserved in DB
      const { data: preservedRows } = await admin
        .from("alumni_employment_history")
        .select("id")
        .in("id", [addedId1, addedId2]);
      assert.equal(
        preservedRows?.length,
        2,
        "Both historical employment records remain permanently preserved"
      );
    }
  );

  // ==========================================================================
  // Test 5: Staff Company Matching & Verification
  // ==========================================================================
  await t.test("Staff Employer Matching & Profile Verification", async () => {
    // 1. Student cannot match company
    const { error: errStudentMatch } = await cGrad1.rpc(
      "match_alumni_company",
      {
        p_alumni_id: sGrad1Id,
        p_company_id: companyId,
        p_reason: "Self matching",
      }
    );
    assert.ok(errStudentMatch, "Student cannot match company");
    assert.equal(errStudentMatch.code, "42501");

    // 2. Staff matching to archived company is rejected
    const { error: errArchMatch } = await cAdmin.rpc("match_alumni_company", {
      p_alumni_id: sGrad1Id,
      p_company_id: archCompanyId,
      p_reason: "Matching to archived firm",
    });
    assert.ok(errArchMatch, "Cannot match to archived company");
    assert.equal(errArchMatch.code, "P0002");

    // 3. Staff matches valid company
    const { error: errStaffMatch } = await cAdmin.rpc("match_alumni_company", {
      p_alumni_id: sGrad1Id,
      p_company_id: companyId,
      p_reason: "Verified employment offer letter with Foster and Partners",
    });
    assert.ok(
      !errStaffMatch,
      `Staff company match failed: ${errStaffMatch?.message}`
    );

    // Verify company_id is set and current_organization is cleared
    const { data: apMatched } = await admin
      .from("alumni_profiles")
      .select("company_id, current_organization")
      .eq("profile_id", sGrad1Id)
      .single();

    assert.equal(apMatched?.company_id, companyId);
    assert.equal(
      apMatched?.current_organization,
      null,
      "current_organization cleared atomically"
    );

    // 4. Staff verifies alumni profile
    const { error: errStaffVerify } = await cAdmin.rpc(
      "verify_alumni_profile",
      {
        p_alumni_id: sGrad1Id,
      }
    );
    assert.ok(
      !errStaffVerify,
      `Staff verification failed: ${errStaffVerify?.message}`
    );

    const { data: apVerified } = await admin
      .from("alumni_profiles")
      .select("last_verified_at, last_verified_by")
      .eq("profile_id", sGrad1Id)
      .single();

    assert.ok(apVerified?.last_verified_at);
    assert.equal(apVerified?.last_verified_by, adminId);

    // 5. Verify employment records still intact after matching and verification
    const alumProfileRes = await admin
      .from("alumni_profiles")
      .select("id")
      .eq("profile_id", sGrad1Id)
      .single();
    const alumProfileId = alumProfileRes.data?.id ?? "";
    const { data: checkEmps } = await admin
      .from("alumni_employment_history")
      .select("id")
      .eq("alumni_id", alumProfileId);
    assert.equal(
      checkEmps?.length,
      2,
      "Employment records survive company matching and staff verification"
    );
  });

  // ==========================================================================
  // Test 6: Public Alumni Directory Privacy & Filtering
  // ==========================================================================
  await t.test(
    "Public Alumni Directory Privacy & Filter Projections",
    async () => {
      // 1. Anonymous can invoke get_public_alumni_directory
      const { data: publicList, error: errPublicDir } = await anon.rpc(
        "get_public_alumni_directory",
        {
          p_limit: 10,
          p_offset: 0,
        }
      );
      assert.ok(!errPublicDir, `Public dir error: ${errPublicDir?.message}`);
      assert.ok(
        (publicList?.length || 0) >= 2,
        "Public directory returns consenting alumni"
      );

      // Verify payload contains ZERO PII
      const item = publicList?.[0];
      assert.ok(item?.name, "Must have public display name");
      assert.ok(item?.graduation_year, "Must have graduation year");
      assert.ok(item?.program_code, "Must have program code");
      assert.ok(item?.current_employer, "Must have employer");
      const record = item as unknown as Record<string, unknown>;
      assert.equal(
        record.email,
        undefined,
        "Zero email PII in public directory"
      );
      assert.equal(
        record.phone,
        undefined,
        "Zero phone PII in public directory"
      );
      assert.equal(record.cgpa, undefined, "Zero CGPA in public directory");
      assert.equal(
        record.backlogs,
        undefined,
        "Zero backlogs in public directory"
      );
      assert.equal(
        record.profile_id,
        undefined,
        "Zero raw profile UUIDs in public directory"
      );
      assert.equal(
        record.willing_to_mentor,
        undefined,
        "Zero internal willingness flags in public directory"
      );

      // 2. Filter by graduation year
      const { data: filter2026 } = await anon.rpc(
        "get_public_alumni_directory",
        {
          p_graduation_year: 2026,
        }
      );
      assert.ok(
        (filter2026?.length || 0) >= 1,
        "Filter by graduation year 2026 returns matching profile"
      );

      // 3. Filter by program code
      const { data: filterBarch } = await anon.rpc(
        "get_public_alumni_directory",
        {
          p_program_code: "BARCH",
        }
      );
      assert.ok(
        (filterBarch?.length || 0) >= 2,
        "Filter by program code BARCH returns records"
      );

      // 4. Opting out immediately removes alumnus from public directory
      await cGrad1.rpc("update_own_alumni_profile", {
        p_company_id: companyId,
        p_current_role: "Architectural Associate",
        p_public_alumni_enabled: false,
      });

      const { data: listAfterOptOut } = await anon.rpc(
        "get_public_alumni_directory",
        {
          p_graduation_year: 2026,
        }
      );
      const foundOptOut = (listAfterOptOut || []).find(
        (a) => a.name === "phase10_grad1"
      );
      assert.equal(
        foundOptOut,
        undefined,
        "Opted-out alumnus immediately absent from directory"
      );

      // Re-enable for remaining assertions
      await cGrad1.rpc("update_own_alumni_profile", {
        p_company_id: companyId,
        p_current_role: "Architectural Associate",
        p_public_alumni_enabled: true,
      });
    }
  );

  // ==========================================================================
  // Test 7: Anonymous Base Table Denials
  // ==========================================================================
  await t.test("Anonymous RLS Base Table Denials", async () => {
    // Anon SELECT base table returns 0 rows
    const { data: anonProfiles } = await anon
      .from("alumni_profiles")
      .select("*");
    assert.equal(
      anonProfiles?.length,
      0,
      "Anonymous SELECT on alumni_profiles must return 0 rows"
    );

    const { data: anonEmps } = await anon
      .from("alumni_employment_history")
      .select("*");
    assert.equal(
      anonEmps?.length,
      0,
      "Anonymous SELECT on alumni_employment_history must return 0 rows"
    );

    // Anon INSERT base table denied
    const { error: errAnonInsert } = await anon.from("alumni_profiles").insert({
      profile_id: sGrad1Id,
      graduation_year: 2026,
      program_id: barchProg.id,
    });
    assert.ok(
      errAnonInsert,
      "Anonymous cannot insert into alumni_profiles base table"
    );

    // Anon UPDATE base table denied
    const { error: errAnonUpdate } = await anon
      .from("alumni_profiles")
      .update({ current_organization: "Pwned" })
      .eq("profile_id", sGrad1Id);
    assert.ok(
      errAnonUpdate,
      "Anonymous cannot update alumni_profiles base table"
    );

    // Anon DELETE base table denied
    const { error: errAnonDelete } = await anon
      .from("alumni_profiles")
      .delete()
      .eq("profile_id", sGrad1Id);
    assert.ok(
      errAnonDelete,
      "Anonymous cannot delete from alumni_profiles base table"
    );
  });

  // ==========================================================================
  // Test 8: Phase 9 Student Showcase Exclusion
  // ==========================================================================
  await t.test(
    "Alumni Exclusion from Phase 9 Public Student Showcase",
    async () => {
      // Both sGrad1Id and sAlumExisting are ALUMNI.
      // They must NEVER appear in Phase 9 student showcase batch page!
      const { data: batch2024 } = await anon.rpc("get_public_batch_page", {
        p_batch: "2024",
      });
      const found2024 = (batch2024 || []).find(
        (s) => s.name === "Vikram Alumni"
      );
      assert.equal(
        found2024,
        undefined,
        "Alumni must NOT appear in Phase 9 student showcase"
      );

      const { data: batch2026 } = await anon.rpc("get_public_batch_page", {
        p_batch: "2026",
      });
      const found2026 = (batch2026 || []).find(
        (s) => s.name === "Prakash Architecture"
      );
      assert.equal(
        found2026,
        undefined,
        "Alumni must NOT appear in Phase 9 student showcase"
      );
    }
  );

  // ==========================================================================
  // Test 9: Staff Analytics Deliverables (Company, Cohort Year, Outreach)
  // ==========================================================================
  await t.test(
    "Staff Analytics Deliverables (Company, Year & Outreach Candidates)",
    async () => {
      // 1. Staff calls get_staff_alumni_by_company
      const { data: companyAnalytics, error: errCompAnalytics } =
        await cAdmin.rpc("get_staff_alumni_by_company", {
          p_limit: 10,
          p_offset: 0,
        });
      assert.ok(
        !errCompAnalytics,
        `Company analytics: ${errCompAnalytics?.message}`
      );
      assert.ok(
        (companyAnalytics?.length || 0) >= 1,
        "Returns alumni aggregated by company"
      );

      // Verify canonical vs unmatched distinction
      const fosterItem = companyAnalytics?.find(
        (c) => c.company_name === "Foster and Partners"
      );
      assert.ok(fosterItem, "Canonical company Foster and Partners listed");
      assert.equal(fosterItem.is_canonical, true);

      // 2. Staff calls get_staff_alumni_by_year
      const { data: yearAnalytics, error: errYearAnalytics } = await cAdmin.rpc(
        "get_staff_alumni_by_year"
      );
      assert.ok(
        !errYearAnalytics,
        `Year analytics: ${errYearAnalytics?.message}`
      );
      assert.ok(
        (yearAnalytics?.length || 0) >= 1,
        "Returns alumni aggregated by graduation year"
      );

      // Verify deterministic descending order
      if (yearAnalytics && yearAnalytics.length >= 2) {
        const y0 = yearAnalytics[0]?.graduation_year ?? 0;
        const y1 = yearAnalytics[1]?.graduation_year ?? 0;
        assert.ok(y0 >= y1, "Years must be ordered DESC");
      }

      // 3. Staff calls get_staff_alumni_outreach_candidates
      const { data: outreachCandidates, error: errOutreach } = await cAdmin.rpc(
        "get_staff_alumni_outreach_candidates",
        {
          p_limit: 10,
          p_offset: 0,
        }
      );
      assert.ok(!errOutreach, `Outreach candidates: ${errOutreach?.message}`);
      assert.ok(
        (outreachCandidates?.length || 0) >= 1,
        "Returns candidates willing to mentor/refer/support"
      );

      const candidate = outreachCandidates?.[0];
      assert.ok(candidate?.name, "Has candidate name");
      assert.ok(
        candidate?.willing_to_mentor ||
          candidate?.willing_to_refer ||
          candidate?.willing_to_support_placement,
        "Candidate has at least one willingness flag true"
      );

      // 4. Recruiter calling analytics is strictly DENIED
      const { error: errRecruiterComp } = await cRecruiter.rpc(
        "get_staff_alumni_by_company"
      );
      assert.ok(errRecruiterComp, "Recruiter cannot access company analytics");
      assert.equal(errRecruiterComp.code, "42501");

      const { error: errRecruiterYear } = await cRecruiter.rpc(
        "get_staff_alumni_by_year"
      );
      assert.ok(errRecruiterYear, "Recruiter cannot access year analytics");
      assert.equal(errRecruiterYear.code, "42501");

      const { error: errRecruiterOutreach } = await cRecruiter.rpc(
        "get_staff_alumni_outreach_candidates"
      );
      assert.ok(
        errRecruiterOutreach,
        "Recruiter cannot access outreach candidates"
      );
      assert.equal(errRecruiterOutreach.code, "42501");

      // 5. Anonymous caller is strictly DENIED
      const { error: errAnonComp } = await anon.rpc(
        "get_staff_alumni_by_company"
      );
      assert.ok(errAnonComp, "Anon cannot access company analytics");
      assert.equal(errAnonComp.code, "42501");
    }
  );

  // ==========================================================================
  // Test 10: Internal Helper Execution Check (is_active_alumni)
  // ==========================================================================
  await t.test("Internal Helper Direct Execution Denial", async () => {
    const { error: errHelperExec } = await cGrad1.rpc(
      "is_active_alumni" as unknown as "get_public_alumni_directory"
    );
    assert.ok(
      errHelperExec,
      "Direct execution of is_active_alumni by authenticated user must be denied"
    );
    assert.equal(errHelperExec.code, "42501");
  });

  // Clean teardown and restore seed admin to active state
  t.after(async () => {
    await admin
      .from("profiles")
      .update({ is_active: false })
      .in("id", [adminId, secId, coordId, recruiterId]);

    await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", "00000000-0000-0000-0000-000000000001");
  });
});
